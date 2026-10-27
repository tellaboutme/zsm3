import { it } from "vitest";

import { slugify } from "../src/lib/panel/slug.ts";
import { bytesPhrase, checkUpload, formatFrom, uploadPhrase } from "../src/lib/panel/uploads.ts";

it("recognizes the allowed upload extensions", ({ expect }) => {
  expect(formatFrom("wynik.PDF")).toBe("pdf");
  expect(formatFrom("wyniki.xlsx")).toBe("xlsx");
  expect(formatFrom("bez-rozszerzenia")).toBeUndefined();
  expect(formatFrom("archiwum.rar")).toBeUndefined();
});

it("pre-checks uploads before the request", ({ expect }) => {
  expect(checkUpload("informator.pdf", 64)).toEqual({
    ok: true,
    format: "pdf",
    parts: ["format: pdf", "rozmiar: 64 B"],
  });
  expect(checkUpload("brak.pdf", 0)).toEqual({ ok: false, reason: "empty" });
  expect(checkUpload("ciężki.pdf", 100 * 1024 * 1024 + 1)).toEqual({ ok: false, reason: "large" });
  expect(checkUpload("obraz.gif", 10)).toEqual({ ok: false, reason: "unknown-format" });
});

it("phrases the upload check", ({ expect }) => {
  expect(uploadPhrase({ ok: true, format: "png", parts: [] })).toBe(
    "Plik spełnia warunki. Możesz wysłać.",
  );
  expect(uploadPhrase({ ok: false, reason: "empty" })).toBe("Plik jest pusty.");
  expect(uploadPhrase({ ok: false, reason: "large" })).toContain("limit 100 MB");
  expect(uploadPhrase({ ok: false, reason: "unknown-format" })).toContain("PDF");
});

it("sizes files for the list", ({ expect }) => {
  expect(bytesPhrase(512)).toBe("512 B");
  expect(bytesPhrase(2048)).toBe("2 KB");
  expect(bytesPhrase(3 * 1024 * 1024)).toBe("3.0 MB");
});

it("slugifies titles for addresses", ({ expect }) => {
  expect(slugify("Dzień otwarty w warsztatach 2026")).toBe("dzien-otwarty-w-warsztatach-2026");
  expect(slugify("Łąka: ś`ź`ż!")).toBe("laka-s-z-z");
  expect(slugify("„Cudzysłów” — i myślnik")).toBe("cudzyslow-i-myslnik");
  expect(slugify("   ")).toBe("");
  expect(slugify("--trudny--adres--")).toBe("trudny-adres");
  expect(slugify("x".repeat(200))).toBe("x".repeat(120));
  expect(slugify("abc ".repeat(40))).toBe(`${"abc-".repeat(29)}abc`);
});
