import { applyD1Migrations } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, it } from "vitest";

import { ORIGIN } from "./support.ts";
import { filesRepo } from "../src/storage/files-repo.ts";
import { cryptoRandom } from "../src/storage/ids.ts";

const hash = "ab".repeat(32);
const pdf = `d/${hash}.pdf`;
const zip = `d/${"cd".repeat(32)}.zip`;
const orphan = `d/${"ef".repeat(32)}.pdf`;
const store = { db: env.DB, clock: () => new Date("2026-10-22T08:00:00Z"), random: cryptoRandom };

async function get(path: string): Promise<Response> {
  return exports.default.fetch(new Request(`${ORIGIN}${path}`));
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  const files = filesRepo(store);
  await files.save({ key: pdf, name: "Statut szkoły.pdf", format: "pdf", bytes: 8 });
  await files.save({ key: zip, name: "plany.zip", format: "zip", bytes: 3 });
  await env.MEDIA.put(pdf, "%PDF-1.7");
  await env.MEDIA.put(zip, "PK!");
  await env.MEDIA.put(orphan, "%PDF-1.7");
});

describe("media files", () => {
  it("serves a registered file with its type, name and a long cache", async ({ expect }) => {
    const response = await get(`/media/${pdf}`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("%PDF-1.7");
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Length")).toBe("8");
    expect(response.headers.get("Content-Disposition")).toBe(
      "inline; filename*=UTF-8''Statut%20szko%C5%82y.pdf",
    );
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("ETag")).toMatch(/^".+"$/u);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  });

  it("offers archives as downloads", async ({ expect }) => {
    const response = await get(`/media/${zip}`);

    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Content-Disposition")).toBe(
      "attachment; filename*=UTF-8''plany.zip",
    );
  });

  it("answers 404 for unknown, unregistered and malformed keys", async ({ expect }) => {
    for (const path of [
      `/media/${orphan}`,
      `/media/d/${"12".repeat(32)}.pdf`,
      "/media/d/statut.pdf",
      `/media/d/${hash}.exe`,
    ]) {
      const response = await get(path);

      expect(response.status, path).toBe(404);
      expect(response.headers.get("Cache-Control"), path).toBe("no-store");
      expect(response.headers.get("Content-Type"), path).toBe("application/problem+json");
    }
  });
});
