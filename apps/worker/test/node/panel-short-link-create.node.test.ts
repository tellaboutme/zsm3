import { panelShortLinkCreatedSchema } from "@zsm3/contracts/panel";
import { describe, it } from "vitest";

import { GALLERY, harness, token } from "./panel-short-link-support.ts";
import { expectProblem, PANEL_ORIGIN, panelJsonCall, panelRawCall } from "./panel-support.ts";

describe("creating a link in the panel", () => {
  it("returns the new link with the school-year expiry and no password material", async ({
    expect,
  }) => {
    const h = await harness();
    const response = await panelJsonCall(h, "POST", "/short-links", {
      token: await token(h),
      body: { target: "https://example.org/lekcja", password: "klasa4tp" },
    });
    const raw: unknown = await response.json();

    expect(response.status).toBe(201);
    const { item } = panelShortLinkCreatedSchema.parse(raw);
    expect(item).toMatchObject({
      target: "https://example.org/lekcja",
      file: null,
      revokedAt: null,
      clicks: 0,
      passwordProtected: true,
    });
    expect(Date.parse(item.expiresAt)).toBeGreaterThan(Date.parse(item.createdAt));
    expect(new Date(item.expiresAt).getUTCDate()).toBe(31);
    expect(JSON.stringify(raw)).not.toMatch(/klasa4tp|salt|hash/u);
  });

  it("maps refused bodies and a missing key to problems", async ({ expect }) => {
    const h = await harness();
    const bearer = await token(h);
    const call = async (body: unknown) =>
      panelJsonCall(h, "POST", "/short-links", { token: bearer, body });

    await expectProblem(await call({ target: "http://example.org" }), 422);
    await expectProblem(await call({ target: "https://example.org", lifetimeDays: 3 }), 422);
    await expectProblem(await call({ target: "https://example.org", password: "x" }), 422);
    const keyless = await harness(false);
    await expectProblem(
      await panelJsonCall(keyless, "POST", "/short-links", {
        token: await token(keyless),
        body: { target: "https://example.org", password: "klasa4tp" },
      }),
      503,
    );
    const open = await panelJsonCall(keyless, "POST", "/short-links", {
      token: await token(keyless),
      body: { target: "https://example.org" },
    });
    expect(open.status).toBe(201);
  });

  it("refuses a body that is not JSON", async ({ expect }) => {
    const h = await harness();
    const response = await panelRawCall(h, "POST", "/short-links", {
      headers: {
        authorization: `Bearer ${await token(h)}`,
        origin: PANEL_ORIGIN,
        "content-type": "application/json",
      },
      body: "{",
    });

    await expectProblem(response, 422);
    expect(response.status).toBe(422);
  });

  it("refuses another origin and a role without content rights", async () => {
    const h = await harness();
    await expectProblem(
      await panelRawCall(h, "POST", "/short-links", {
        headers: {
          authorization: `Bearer ${await token(h)}`,
          origin: "https://evil.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ target: "https://example.org" }),
      }),
      403,
    );
    await expectProblem(
      await panelJsonCall(h, "POST", "/short-links", {
        token: await token(h, GALLERY),
        body: { target: "https://example.org" },
      }),
      403,
    );
    await expectProblem(
      await panelJsonCall(h, "POST", "/short-links", {
        token: "forged.token.value",
        body: { target: "https://example.org" },
      }),
      401,
    );
  });
});
