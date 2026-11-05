import { describe, it } from "vitest";

import { text, zipOf } from "./zip-fixtures.ts";
import { storedFirstEntry, zipNames } from "../../src/domain/zip-directory.ts";

const END_SIZE = 22;

function endRecord(count: number, size: number, offset: number): Uint8Array {
  const end = new Uint8Array(END_SIZE);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06_05_4b_50, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, size, true);
  view.setUint32(16, offset, true);
  return end;
}

function emptyLocalHeader(): Uint8Array {
  const header = new Uint8Array(30);
  new DataView(header.buffer).setUint32(0, 0x04_03_4b_50, true);
  return header;
}

function withTruncatedEntry(archive: Uint8Array): Uint8Array {
  const end = archive.length - END_SIZE;
  const view = new DataView(archive.buffer);
  const offset = view.getUint32(end + 16, true);
  const size = view.getUint32(end + 12, true);
  const stub = new Uint8Array(10);
  new DataView(stub.buffer).setUint32(0, 0x02_01_4b_50, true);
  const result = new Uint8Array(archive.length + stub.length);
  result.set(archive.subarray(0, end));
  result.set(stub, end);
  result.set(endRecord(view.getUint16(end + 10, true) + 1, size + stub.length, offset), end + 10);
  return result;
}

describe("bounds of a zip directory", () => {
  it("steps over extra fields and comments in the directory", ({ expect }) => {
    const archive = zipOf([{ name: "a", centralExtra: 3, centralComment: 5 }, { name: "b" }]);

    expect(zipNames(archive)).toEqual(["a", "b"]);
  });

  it("accepts a last entry that ends exactly at the end record", ({ expect }) => {
    expect(zipNames(zipOf([{ name: "a" }, { name: "" }]))).toEqual(["a", ""]);
  });

  it("refuses an entry header cut short by the end record", ({ expect }) => {
    expect(zipNames(withTruncatedEntry(zipOf([{ name: "a" }])))).toBeUndefined();
  });

  it("refuses any disk number, not only small ones", ({ expect }) => {
    const archive = zipOf([{ name: "a" }]);
    const end = archive.length - END_SIZE;
    for (const field of [4, 6]) {
      const copy = archive.slice();
      new DataView(copy.buffer).setUint16(end + field, 0x01_00, true);
      expect(zipNames(copy)).toBeUndefined();
    }
  });

  it("refuses an archive that lists no entries", ({ expect }) => {
    const header = emptyLocalHeader();
    const bytes = new Uint8Array(header.length + END_SIZE);
    bytes.set(header);
    bytes.set(endRecord(0, 0, header.length), header.length);

    expect(zipNames(bytes)).toBeUndefined();
  });

  it("refuses an archive that does not start with an entry", ({ expect }) => {
    expect(zipNames(zipOf([{ name: "a" }], { prefix: text("<html>") }))).toBeUndefined();
    expect(zipNames(new Uint8Array([0x50, 0x4b, 0x03]))).toBeUndefined();
    expect(zipNames(zipOf([{ name: "a" }], { prefix: text("PK") }))).toBeUndefined();
  });

  it("keeps a byte order mark as part of the name", ({ expect }) => {
    expect(zipNames(zipOf([{ name: "\uFEFFa" }]))).toEqual(["\uFEFFa"]);
  });
});

describe("bounds of the first stored entry", () => {
  it("reads a bare header with no name and no data", ({ expect }) => {
    expect(storedFirstEntry(emptyLocalHeader())).toEqual({ name: "", data: new Uint8Array() });
  });

  it("refuses bytes that only look like an empty header", ({ expect }) => {
    expect(storedFirstEntry(new Uint8Array(40))).toBeUndefined();
    expect(storedFirstEntry(emptyLocalHeader().slice(0, 29))).toBeUndefined();
  });

  it("refuses any compression method, not only small ones", ({ expect }) => {
    const header = emptyLocalHeader();
    new DataView(header.buffer).setUint16(8, 0x01_00, true);

    expect(storedFirstEntry(header)).toBeUndefined();
  });
});
