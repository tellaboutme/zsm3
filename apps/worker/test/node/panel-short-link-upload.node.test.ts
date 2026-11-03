import { panelShortLinkCreatedSchema, panelShortLinksListSchema } from "@zsm3/contracts/panel";
import { describe, it } from "vitest";

import { GALLERY, harness, OTHER, token, uploadRequest } from "./panel-short-link-support.ts";
import {
  expectProblem,
  PANEL_ORIGIN,
  panelJsonCall,
  panelRawCall,
  panelUrl,
} from "./panel-support.ts";
import { docx, PDF } from "./zip-fixtures.ts";
import { bodyLimitFor, MAX_BODY_BYTES } from "../../src/app.ts";
import { MAX_UPLOAD_BODY_BYTES } from "../../src/routes/panel/files.ts";
import {
  LINK_UPLOAD_PATH,
  MAX_LINK_UPLOAD_BODY_BYTES,
} from "../../src/routes/panel/short-link-files.ts";

describe("uploading a file link in the panel", () => {
  it("creates a private file link that the author can list and nobody else sees", async ({
    expect,
  }) => {
    const h = await harness();
    const bearer = await token(h);
    const response = await h.app.fetch(
      uploadRequest(bearer, new File([PDF], "Karta pracy.pdf", { type: "text/html" }), {
        password: "klasa4tp-2026",
      }),
      h.env,
    );
    const raw: unknown = await response.json();

    expect(response.status).toBe(201);
    const { item } = panelShortLinkCreatedSchema.parse(raw);
    expect(item).toMatchObject({
      target: null,
      file: { name: "Karta pracy.pdf", format: "pdf", bytes: PDF.length },
      passwordProtected: true,
    });
    expect(JSON.stringify(raw)).not.toMatch(/s\/0|object|klasa4tp-2026/u);
    const mine = await panelJsonCall(h, "GET", "/short-links", { token: bearer });
    expect(panelShortLinksListSchema.parse(await mine.json()).items).toEqual([item]);
    const theirs = await panelJsonCall(h, "GET", "/short-links", { token: await token(h, OTHER) });
    expect(panelShortLinksListSchema.parse(await theirs.json()).items).toEqual([]);
    await expectProblem(
      await panelJsonCall(h, "DELETE", `/short-links/${item.code}`, {
        token: await token(h, OTHER),
        body: {},
      }),
      404,
    );
    const revoked = await panelJsonCall(h, "DELETE", `/short-links/${item.code}`, {
      token: bearer,
      body: {},
    });
    expect(revoked.status).toBe(204);
  });

  it("treats an empty password field as no password", async ({ expect }) => {
    const h = await harness();
    const response = await h.app.fetch(
      uploadRequest(await token(h), new File([docx()], "zadanie.docx"), { password: "" }),
      h.env,
    );

    expect(response.status).toBe(201);
    expect(panelShortLinkCreatedSchema.parse(await response.json()).item.passwordProtected).toBe(
      false,
    );
  });

  it("maps each refused upload to its own problem", async () => {
    const h = await harness();
    const bearer = await token(h);
    const send = async (file: File | string, fields: Record<string, string> = {}) =>
      h.app.fetch(uploadRequest(bearer, file, fields), h.env);

    await expectProblem(await send(new File([], "pusty.pdf")), 422);
    await expectProblem(await send(new File([PDF], "karta.svg")), 415);
    await expectProblem(await send(new File(["<script>"], "karta.pdf")), 415);
    await expectProblem(await send(new File([PDF], "karta.pdf"), { password: "krot" }), 422);
    await expectProblem(await send("nie-plik"), 422);
    const keyless = await harness(false);
    await expectProblem(
      await keyless.app.fetch(
        uploadRequest(await token(keyless), new File([PDF], "karta.pdf"), {
          password: "klasa4tp-2026",
        }),
        keyless.env,
      ),
      503,
    );
  });

  it("refuses a password sent as a file and a body that is not a form", async () => {
    const h = await harness();
    const bearer = await token(h);
    const form = new FormData();
    form.set("file", new File([PDF], "karta.pdf"));
    form.set("password", new File(["klasa4tp-2026"], "haslo.txt"));
    await expectProblem(
      await h.app.fetch(
        new Request(panelUrl("/short-links/files"), {
          method: "POST",
          headers: { authorization: `Bearer ${bearer}`, origin: PANEL_ORIGIN },
          body: form,
        }),
        h.env,
      ),
      422,
    );
    await expectProblem(
      await panelRawCall(h, "POST", "/short-links/files", {
        headers: {
          authorization: `Bearer ${bearer}`,
          origin: PANEL_ORIGIN,
          "content-type": "multipart/form-data; boundary=x",
        },
        body: "nie formularz",
      }),
      422,
    );
  });

  it("refuses an upload from another origin or a role without content rights", async () => {
    const h = await harness();
    const file = new File([PDF], "karta.pdf");
    const foreign = uploadRequest(await token(h), file);
    foreign.headers.set("origin", "https://evil.example");
    await expectProblem(await h.app.fetch(foreign, h.env), 403);
    await expectProblem(
      await h.app.fetch(uploadRequest(await token(h, GALLERY), file), h.env),
      403,
    );
  });
});

describe("request size limits", () => {
  it("raise the limit only for the upload paths", ({ expect }) => {
    expect(LINK_UPLOAD_PATH).toBe("/api/panel/short-links/files");
    expect(MAX_LINK_UPLOAD_BODY_BYTES).toBe(20 * 1024 * 1024 + 64 * 1024);
    expect(bodyLimitFor(LINK_UPLOAD_PATH)).toBe(MAX_LINK_UPLOAD_BODY_BYTES);
    expect(bodyLimitFor("/api/panel/files")).toBe(MAX_UPLOAD_BODY_BYTES);
    expect(bodyLimitFor("/api/panel/short-links")).toBe(MAX_BODY_BYTES);
    expect(bodyLimitFor(`${LINK_UPLOAD_PATH}/x`)).toBe(MAX_BODY_BYTES);
  });

  it("refuses an upload body above the file limit", async () => {
    const h = await harness();
    const big = new Uint8Array(MAX_LINK_UPLOAD_BODY_BYTES + 1);
    big.set(PDF);
    await expectProblem(
      await h.app.fetch(uploadRequest(await token(h), new File([big], "duzy.pdf")), h.env),
      413,
    );
  });
});
