import { MAX_FILE_BYTES, storedFileSchema } from "@zsm3/contracts/media";
import { panelFileListSchema } from "@zsm3/contracts/panel";
import { it } from "vitest";
import { z } from "zod";

import { staffMember } from "./panel-fixtures.ts";
import {
  expectProblem,
  panelAudit,
  panelHarness,
  panelJsonCall,
  panelRawCall,
  panelUploadRequest,
  panelUrl,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";

const ADMIN = staffMember("admin@zsm3.test", "admin", true);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x20]);
const fieldsSchema = z.object({ fields: z.array(z.string()) });

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function uploadCall(
  harness: Awaited<ReturnType<typeof panelHarness>>,
  token: string,
  file: File,
): Promise<Response> {
  return await harness.app.fetch(panelUploadRequest(token, file), harness.env);
}

it("answers an empty file list", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  const response = await panelJsonCall(harness, "GET", "/files", { token });
  const raw: unknown = await response.json();
  expect(response.status).toBe(200);
  expect(panelFileListSchema.parse(raw)).toEqual({ items: [] });
});

it("stores an upload under its content hash", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  const upload = await uploadCall(harness, token, new File([PDF], "raport.pdf"));
  expect(upload.status).toBe(201);
  const storedRaw: unknown = await upload.json();
  const stored = z.object({ item: storedFileSchema }).parse(storedRaw).item;
  expect(stored.key).toBe(`d/${await sha256(PDF)}.pdf`);
  expect(stored.name).toBe("raport.pdf");

  const list = await panelJsonCall(harness, "GET", "/files", { token });
  const listRaw: unknown = await list.json();
  expect(panelFileListSchema.parse(listRaw)).toEqual({ items: [stored] });

  const created = (await panelAudit(harness.env).byEntity("files", stored.key, 10)).map((row) =>
    fieldsSchema.parse(JSON.parse(row.details)),
  );
  expect(created).toEqual([{ fields: ["name"] }]);
});

it("upserts a second upload of the same content", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  await uploadCall(harness, token, new File([PDF], "raport.pdf"));

  expect((await uploadCall(harness, token, new File([PDF], "procedura.pdf"))).status).toBe(201);
  const list = await panelJsonCall(harness, "GET", "/files", { token });
  const raw: unknown = await list.json();
  const items = panelFileListSchema.parse(raw).items;
  expect(items).toHaveLength(1);
  expect(items[0]?.name).toBe("procedura.pdf");
});

it("rejects missing and malformed upload bodies", async () => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  const wrongField = new FormData();
  wrongField.set("nota", new File([PDF], "raport.pdf"));
  await expectProblem(
    await harness.app.fetch(
      new Request(panelUrl("/files"), {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, origin: "https://panel.zsm3.test" },
        body: wrongField,
      }),
      harness.env,
    ),
    422,
  );

  const noOrigin = new FormData();
  noOrigin.set("file", new File([PDF], "raport.pdf"));
  await expectProblem(
    await harness.app.fetch(
      new Request(panelUrl("/files"), {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: noOrigin,
      }),
      harness.env,
    ),
    403,
  );

  const noBoundary = new FormData();
  noBoundary.set("file", new File([PDF], "raport.pdf"));
  await expectProblem(
    await panelRawCall(harness, "POST", "/files", {
      headers: {
        authorization: `Bearer ${token}`,
        origin: "https://panel.zsm3.test",
        "content-type": "multipart/form-data",
      },
      body: "brak-granicy",
    }),
    422,
  );
});

it("treats uppercase extensions like their lowercase equivalents", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  const upper = await uploadCall(harness, token, new File([PDF], "IMG_1001.JPG"));
  expect(upper.status).toBe(201);
  const upperRaw: unknown = await upper.json();
  const upperStored = z.object({ item: storedFileSchema }).parse(upperRaw).item;
  expect(upperStored.key).toBe(`d/${await sha256(PDF)}.jpg`);
  expect(upperStored.name).toBe("IMG_1001.JPG");

  const report = await uploadCall(harness, token, new File([PDF], "Raport.PDF"));
  expect(report.status).toBe(201);
  const reportRaw: unknown = await report.json();
  const reportStored = z.object({ item: storedFileSchema }).parse(reportRaw).item;
  expect(reportStored.key).toBe(`d/${await sha256(PDF)}.pdf`);

  const lower = await uploadCall(harness, token, new File([PDF], "raport.pdf"));
  expect(lower.status).toBe(201);
  const list = await panelJsonCall(harness, "GET", "/files", { token });
  const listRaw: unknown = await list.json();
  const items = panelFileListSchema.parse(listRaw).items;
  expect(items.map((row) => row.key).toSorted()).toEqual(
    [upperStored.key, reportStored.key].toSorted(),
  );
  expect(items.map((row) => row.name).toSorted()).toEqual(["IMG_1001.JPG", "raport.pdf"]);
});

it("rejects unsupported formats and invalid sizes", async () => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  await expectProblem(await uploadCall(harness, token, new File([PDF], "plik.exe")), 422);
  await expectProblem(await uploadCall(harness, token, new File([PDF], "plik")), 422);
  await expectProblem(await uploadCall(harness, token, new File([], "pusty.pdf")), 422);
  await expectProblem(
    await uploadCall(harness, token, new File([new Uint8Array(MAX_FILE_BYTES + 1)], "duzy.pdf")),
    413,
  );
  await expectProblem(
    await uploadCall(harness, token, new File([PDF], `${"a".repeat(250)}.pdf`)),
    422,
  );
});
