import { describe, it } from "vitest";

import { docx, openDocument, PDF, text, zipOf } from "./zip-fixtures.ts";
import { MAX_ZIP_ENTRIES, storedFirstEntry, zipNames } from "../../src/domain/zip-directory.ts";

const ODT = "application/vnd.oasis.opendocument.text";

describe("reading a zip directory", () => {
  it("lists the entry names of a well-formed archive", ({ expect }) => {
    expect(zipNames(docx())).toEqual(["[Content_Types].xml", "word/document.xml"]);
    expect(zipNames(zipOf([{ name: "a" }], { comment: "komentarz" }))).toEqual(["a"]);
  });

  it("refuses data that is not exactly one complete archive", ({ expect }) => {
    expect(zipNames(new Uint8Array())).toBeUndefined();
    expect(zipNames(new Uint8Array(21))).toBeUndefined();
    expect(zipNames(PDF)).toBeUndefined();
    expect(zipNames(zipOf([{ name: "a" }], { trailing: 1 }))).toBeUndefined();
    expect(zipNames(zipOf([]))).toBeUndefined();
    expect(zipNames(zipOf([{ name: "a" }], { countDelta: 1 }))).toBeUndefined();
    expect(zipNames(zipOf([{ name: "a" }, { name: "b" }], { countDelta: -1 }))).toBeUndefined();
  });

  it("refuses a directory that disagrees with its end record", ({ expect }) => {
    const archive = zipOf([{ name: "a" }]);
    const view = new DataView(archive.buffer);
    const end = archive.length - 22;
    const broken = (patch: (copy: DataView) => void): Uint8Array => {
      const copy = archive.slice();
      patch(new DataView(copy.buffer));
      return copy;
    };
    expect(
      zipNames(
        broken((copy) => {
          copy.setUint16(end + 4, 1, true);
        }),
      ),
    ).toBeUndefined();
    expect(
      zipNames(
        broken((copy) => {
          copy.setUint16(end + 6, 1, true);
        }),
      ),
    ).toBeUndefined();
    expect(
      zipNames(
        broken((copy) => {
          copy.setUint16(end + 8, 2, true);
        }),
      ),
    ).toBeUndefined();
    expect(
      zipNames(
        broken((copy) => {
          copy.setUint32(end + 12, view.getUint32(end + 12, true) - 1, true);
        }),
      ),
    ).toBeUndefined();
    expect(
      zipNames(
        broken((copy) => {
          copy.setUint32(end + 16, 0, true);
        }),
      ),
    ).toBeUndefined();
    const central = view.getUint32(end + 16, true);
    expect(
      zipNames(
        broken((copy) => {
          copy.setUint32(central, 0, true);
        }),
      ),
    ).toBeUndefined();
    expect(
      zipNames(
        broken((copy) => {
          copy.setUint16(central + 28, 9, true);
        }),
      ),
    ).toBeUndefined();
    expect(
      zipNames(
        broken((copy) => {
          copy.setUint16(central + 30, 1, true);
        }),
      ),
    ).toBeUndefined();
    expect(
      zipNames(
        broken((copy) => {
          copy.setUint16(central + 32, 1, true);
        }),
      ),
    ).toBeUndefined();
  });

  it("refuses names that are not valid UTF-8 and caps the number of entries", ({ expect }) => {
    const archive = zipOf([{ name: "ab" }]);
    const central = new DataView(archive.buffer).getUint32(archive.length - 22 + 16, true);
    archive[central + 46] = 0xff;
    expect(zipNames(archive)).toBeUndefined();
    const many = [...Array(MAX_ZIP_ENTRIES + 1).keys()].map((index) => ({ name: String(index) }));
    expect(zipNames(zipOf(many.slice(0, MAX_ZIP_ENTRIES)))).toHaveLength(MAX_ZIP_ENTRIES);
    expect(zipNames(zipOf(many))).toBeUndefined();
  });

  it("finds the end record behind the longest comment it allows", ({ expect }) => {
    expect(zipNames(zipOf([{ name: "a" }], { comment: "x".repeat(0xff_ff) }))).toEqual(["a"]);
  });

  it("reads the first stored entry and refuses a compressed or cut one", ({ expect }) => {
    const archive = openDocument(ODT);
    expect(storedFirstEntry(archive)).toEqual({ name: "mimetype", data: text(ODT) });
    expect(
      storedFirstEntry(zipOf([{ name: "mimetype", data: text(ODT), method: 8 }])),
    ).toBeUndefined();
    expect(storedFirstEntry(new Uint8Array(29))).toBeUndefined();
    expect(storedFirstEntry(PDF.slice(0, 30))).toBeUndefined();
    const cut = archive.slice(0, 30 + 8 + ODT.length - 1);
    expect(storedFirstEntry(cut)).toBeUndefined();
    const exact = archive.slice(0, 30 + 8 + ODT.length);
    expect(storedFirstEntry(exact)).toEqual({ name: "mimetype", data: text(ODT) });
    const garbled = archive.slice();
    garbled[30] = 0xff;
    expect(storedFirstEntry(garbled)).toBeUndefined();
  });

  it("skips the extra field before the stored data", ({ expect }) => {
    const archive = openDocument(ODT);
    const name = text("mimetype");
    const shifted = new Uint8Array(archive.length + 4);
    shifted.set(archive.subarray(0, 30 + name.length));
    new DataView(shifted.buffer).setUint16(28, 4, true);
    shifted.set(archive.subarray(30 + name.length), 30 + name.length + 4);
    expect(storedFirstEntry(shifted)?.data).toEqual(text(ODT));
  });
});
