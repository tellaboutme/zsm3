import { MAX_LINK_FILE_BYTES } from "@zsm3/contracts/short-links";
import { describe, it } from "vitest";

import { docx, OFFICE_MANIFEST, openDocument, PDF, text, zipOf } from "./zip-fixtures.ts";
import {
  detectFormat,
  extensionOf,
  FALLBACK_STEM,
  inspectUpload,
  MAX_FILE_STEM_LENGTH,
  safeFileName,
  uploadSize,
} from "../../src/domain/link-file.ts";

const ODT = "application/vnd.oasis.opendocument.text";

describe("detecting a teaching document", () => {
  it("recognises each accepted format by its content", ({ expect }) => {
    expect(detectFormat(PDF)).toBe("pdf");
    expect(detectFormat(docx())).toBe("docx");
    expect(detectFormat(zipOf([OFFICE_MANIFEST, { name: "xl/workbook.xml" }]))).toBe("xlsx");
    expect(detectFormat(zipOf([OFFICE_MANIFEST, { name: "ppt/presentation.xml" }]))).toBe("pptx");
    expect(detectFormat(openDocument(ODT))).toBe("odt");
    expect(detectFormat(openDocument("application/vnd.oasis.opendocument.spreadsheet"))).toBe(
      "ods",
    );
    expect(detectFormat(openDocument("application/vnd.oasis.opendocument.presentation"))).toBe(
      "odp",
    );
  });

  it("refuses active content and containers it cannot vouch for", ({ expect }) => {
    expect(detectFormat(text("<!doctype html><script>alert(1)</script>"))).toBeUndefined();
    expect(detectFormat(text("<svg onload=alert(1)>"))).toBeUndefined();
    expect(detectFormat(text("MZ\u0090\u0000"))).toBeUndefined();
    expect(detectFormat(text("%PDF"))).toBeUndefined();
    expect(detectFormat(text(" %PDF-1.7"))).toBeUndefined();
    expect(detectFormat(zipOf([{ name: "readme.txt" }]))).toBeUndefined();
    expect(detectFormat(zipOf([{ name: "word/document.xml" }]))).toBeUndefined();
    expect(detectFormat(zipOf([OFFICE_MANIFEST, { name: "word/styles.xml" }]))).toBeUndefined();
    expect(detectFormat(docx([{ name: "word/vbaProject.bin" }]))).toBeUndefined();
    expect(detectFormat(docx([{ name: "word/activeX/activeX1.xml" }]))).toBeUndefined();
    expect(detectFormat(docx([{ name: "VBAPROJECT.BIN" }]))).toBeUndefined();
    expect(
      detectFormat(openDocument(ODT, [{ name: "Basic/Standard/Module1.xml" }])),
    ).toBeUndefined();
    expect(detectFormat(openDocument(ODT, [{ name: "Scripts/python/x.py" }]))).toBeUndefined();
    expect(detectFormat(openDocument("text/html"))).toBeUndefined();
    expect(
      detectFormat(zipOf([{ name: "mimetype", data: text(ODT) }, { name: "styles.xml" }])),
    ).toBeUndefined();
    expect(
      detectFormat(zipOf([{ name: "content.xml" }, { name: "mimetype", data: text(ODT) }])),
    ).toBeUndefined();
  });

  it("refuses an office archive hidden behind other content", ({ expect }) => {
    const entries = [OFFICE_MANIFEST, { name: "word/document.xml", method: 8 }];
    const html = text("<!doctype html><script>alert(1)</script>");

    expect(detectFormat(zipOf(entries, { prefix: html }))).toBeUndefined();
    expect(detectFormat(zipOf(entries, { prefix: text("x") }))).toBeUndefined();
    expect(detectFormat(zipOf(entries, { prefix: new Uint8Array() }))).toBe("docx");
  });

  it("keeps harmless parts that only resemble active ones", ({ expect }) => {
    expect(detectFormat(docx([{ name: "word/media/basic/image.png" }]))).toBe("docx");
    expect(detectFormat(docx([{ name: "word/embeddings/oleObject1.bin" }]))).toBe("docx");
  });
});

describe("naming an uploaded file", () => {
  it("reads the extension case-insensitively", ({ expect }) => {
    expect(extensionOf("Karta.PDF")).toBe("pdf");
    expect(extensionOf("bez-rozszerzenia")).toBe("");
    expect(extensionOf("a.tar.gz")).toBe("gz");
  });

  it("keeps a readable Polish name and the detected extension", ({ expect }) => {
    expect(safeFileName("Ćwiczenia z fizyki.pdf", "pdf")).toBe("Ćwiczenia z fizyki.pdf");
    expect(safeFileName("plan.PDF", "pdf")).toBe("plan.pdf");
    expect(safeFileName("Zestaw\u0301.docx", "docx")).toBe("Zestaẃ.docx");
  });

  it("drops paths, controls, quotes and leading dots", ({ expect }) => {
    expect(safeFileName("C:\\Users\\nauczyciel\\..\\karta.pdf", "pdf")).toBe("karta.pdf");
    expect(safeFileName("../../etc/passwd.pdf", "pdf")).toBe("passwd.pdf");
    expect(safeFileName('a"b*c:d<e>f?g|h\u0000\u200e.pdf', "pdf")).toBe("abcdefgh.pdf");
    expect(safeFileName("...ukryty.pdf", "pdf")).toBe("ukryty.pdf");
    expect(safeFileName(" \t lekcja \n 3 .pdf", "pdf")).toBe("lekcja 3.pdf");
    expect(safeFileName("bez kropki", "odt")).toBe("bez kropki.odt");
  });

  it("falls back to a neutral stem and caps the length by characters", ({ expect }) => {
    expect(FALLBACK_STEM).toBe("material");
    expect(safeFileName(".pdf", "pdf")).toBe("material.pdf");
    expect(safeFileName("<>.pdf", "pdf")).toBe("material.pdf");
    expect(safeFileName("folder/", "pdf")).toBe("material.pdf");
    const long = safeFileName(`${"ż".repeat(MAX_FILE_STEM_LENGTH + 10)}.pdf`, "pdf");
    expect(long).toBe(`${"ż".repeat(MAX_FILE_STEM_LENGTH)}.pdf`);
    const emoji = safeFileName(`${"😀".repeat(MAX_FILE_STEM_LENGTH + 1)}.pdf`, "pdf");
    expect(Array.from(emoji.slice(0, -4))).toHaveLength(MAX_FILE_STEM_LENGTH);
    expect(safeFileName(`${"a".repeat(MAX_FILE_STEM_LENGTH - 1)} b.pdf`, "pdf")).toBe(
      `${"a".repeat(MAX_FILE_STEM_LENGTH - 1)}.pdf`,
    );
  });
});

describe("inspecting an upload", () => {
  it("accepts content whose extension matches it", ({ expect }) => {
    expect(inspectUpload("karta.pdf", PDF)).toEqual({
      kind: "accepted",
      format: "pdf",
      name: "karta.pdf",
    });
    expect(inspectUpload("Zadanie.DOCX", docx())).toEqual({
      kind: "accepted",
      format: "docx",
      name: "Zadanie.docx",
    });
  });

  it("refuses a name that claims another format or content it does not know", ({ expect }) => {
    expect(inspectUpload("karta.docx", PDF)).toEqual({ kind: "unsupported" });
    expect(inspectUpload("karta.html", PDF)).toEqual({ kind: "unsupported" });
    expect(inspectUpload("karta", PDF)).toEqual({ kind: "unsupported" });
    expect(inspectUpload("strona.pdf", text("<html></html>"))).toEqual({ kind: "unsupported" });
  });

  it("sorts sizes into empty, too large and acceptable", ({ expect }) => {
    expect(uploadSize(0)).toBe("empty");
    expect(uploadSize(1)).toBe("ok");
    expect(uploadSize(MAX_LINK_FILE_BYTES)).toBe("ok");
    expect(uploadSize(MAX_LINK_FILE_BYTES + 1)).toBe("large");
  });
});
