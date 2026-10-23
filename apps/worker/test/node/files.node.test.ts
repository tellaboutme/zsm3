import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { contentDisposition, IMMUTABLE } from "../../src/http/media-headers.ts";
import { filesRepo } from "../../src/storage/files-repo.ts";

const key = `d/${"ab".repeat(32)}.pdf`;

describe("files repository", () => {
  it("stores files once per key and renames them on a second save", async ({ expect }) => {
    const repo = filesRepo({ db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() });
    await repo.save({ key, name: "a.pdf", format: "pdf", bytes: 10 });
    await repo.save({ key, name: "b.pdf", format: "pdf", bytes: 99 });

    expect(await repo.find(key)).toEqual({ key, name: "b.pdf", format: "pdf", bytes: 10 });
    expect(await repo.find(`d/${"cd".repeat(32)}.pdf`)).toBeUndefined();
  });

  it("rejects files outside the contract", async ({ expect }) => {
    const repo = filesRepo({ db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() });

    await expect(
      repo.save({ key: "d/x.pdf", name: "x.pdf", format: "pdf", bytes: 1 }),
    ).rejects.toThrow();
  });
});

describe("media headers", () => {
  it("shows documents and images inline and downloads the rest", ({ expect }) => {
    expect(contentDisposition("Plan lekcji.pdf", "pdf")).toBe(
      "inline; filename*=UTF-8''Plan%20lekcji.pdf",
    );
    expect(contentDisposition("mapa.png", "png")).toBe("inline; filename*=UTF-8''mapa.png");
    expect(contentDisposition("foto.jpg", "jpg")).toBe("inline; filename*=UTF-8''foto.jpg");
    expect(contentDisposition("plany.7z", "7z")).toBe("attachment; filename*=UTF-8''plany.7z");
    expect(IMMUTABLE).toBe("public, max-age=31536000, immutable");
  });
});
