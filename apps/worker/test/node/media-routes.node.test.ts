import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { createApp } from "../../src/app.ts";
import { filesRepo } from "../../src/storage/files-repo.ts";

const key = `d/${"ab".repeat(32)}.pdf`;

describe("document HTTP routes in Node", () => {
  it("serves only registered, present documents with their correct headers", async ({ expect }) => {
    const DB = memoryDatabase();
    await filesRepo({ db: DB, clock: FIXED_CLOCK, random: counterRandom() }).save({
      key,
      name: "School statute.pdf",
      format: "pdf",
      bytes: 8,
    });
    const MEDIA = {
      get: async (
        requested: string,
      ): Promise<{
        body: ReadableStream<Uint8Array>;
        size: number;
        httpEtag: string;
      } | null> =>
        await Promise.resolve(
          requested === key
            ? {
                body: new ReadableStream<Uint8Array>({
                  start(controller) {
                    controller.enqueue(new TextEncoder().encode("%PDF-1.7"));
                    controller.close();
                  },
                }),
                size: 8,
                httpEtag: '"statute"',
              }
            : null,
        ),
    };
    const app = createApp();
    const get = async (path: string): Promise<Response> =>
      await app.request(`https://zsm3.test/media/${path}`, {}, { DB, MEDIA });

    const found = await get(key);
    expect(found.status).toBe(200);
    expect(new TextDecoder().decode(await found.arrayBuffer())).toBe("%PDF-1.7");
    expect(found.headers.get("Content-Type")).toBe("application/pdf");
    expect(found.headers.get("Content-Length")).toBe("8");
    expect(found.headers.get("Content-Disposition")).toBe(
      "inline; filename*=UTF-8''School%20statute.pdf",
    );
    expect(found.headers.get("ETag")).toBe('"statute"');
    expect(found.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    for (const path of ["d/invalid.pdf", `d/${"cd".repeat(32)}.pdf`]) {
      expect((await get(path)).status).toBe(404);
    }
    const missingObject = await app.request(
      `https://zsm3.test/media/${key}`,
      {},
      {
        DB,
        MEDIA: { get: async (): Promise<null> => await Promise.resolve(null) },
      },
    );
    expect(missingObject.status).toBe(404);
  });
});
