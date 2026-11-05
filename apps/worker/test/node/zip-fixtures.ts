export interface ZipEntryFixture {
  readonly name: string;
  readonly data?: Uint8Array;
  readonly method?: number;
  readonly centralExtra?: number;
  readonly centralComment?: number;
}

export interface ZipOptions {
  readonly comment?: string;
  readonly trailing?: number;
  readonly countDelta?: number;
  readonly prefix?: Uint8Array;
}

const encoder = new TextEncoder();

function local(entry: ZipEntryFixture): Uint8Array {
  const name = encoder.encode(entry.name);
  const data = entry.data ?? new Uint8Array();
  const bytes = new Uint8Array(30 + name.length + data.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x04_03_4b_50, true);
  view.setUint16(8, entry.method ?? 0, true);
  view.setUint32(18, data.length, true);
  view.setUint32(22, data.length, true);
  view.setUint16(26, name.length, true);
  bytes.set(name, 30);
  bytes.set(data, 30 + name.length);
  return bytes;
}

function central(entry: ZipEntryFixture, offset: number): Uint8Array {
  const name = encoder.encode(entry.name);
  const extra = entry.centralExtra ?? 0;
  const comment = entry.centralComment ?? 0;
  const bytes = new Uint8Array(46 + name.length + extra + comment);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x02_01_4b_50, true);
  view.setUint16(10, entry.method ?? 0, true);
  view.setUint16(28, name.length, true);
  view.setUint16(30, extra, true);
  view.setUint16(32, comment, true);
  view.setUint32(42, offset, true);
  bytes.set(name, 46);
  return bytes;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    bytes.set(part, at);
    at += part.length;
  }
  return bytes;
}

export function zipOf(entries: readonly ZipEntryFixture[], options: ZipOptions = {}): Uint8Array {
  const locals = entries.map(local);
  const prefix = options.prefix ?? new Uint8Array();
  const offsets: number[] = [];
  let offset = prefix.length;
  for (const part of locals) {
    offsets.push(offset);
    offset += part.length;
  }
  const directory = concat(entries.map((entry, index) => central(entry, offsets[index] ?? 0)));
  const body = concat(locals);
  const comment = encoder.encode(options.comment ?? "");
  const end = new Uint8Array(22 + comment.length);
  const view = new DataView(end.buffer);
  const count = entries.length + (options.countDelta ?? 0);
  view.setUint32(0, 0x06_05_4b_50, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, directory.length, true);
  view.setUint32(16, prefix.length + body.length, true);
  view.setUint16(20, comment.length, true);
  end.set(comment, 22);
  return concat([prefix, body, directory, end, new Uint8Array(options.trailing ?? 0)]);
}

export function text(value: string): Uint8Array {
  return encoder.encode(value);
}

export const OFFICE_MANIFEST = { name: "[Content_Types].xml", data: text("<Types/>"), method: 8 };

export function docx(extra: readonly ZipEntryFixture[] = []): Uint8Array {
  return zipOf([OFFICE_MANIFEST, { name: "word/document.xml", method: 8 }, ...extra]);
}

export function openDocument(mime: string, extra: readonly ZipEntryFixture[] = []): Uint8Array {
  return zipOf([
    { name: "mimetype", data: text(mime) },
    { name: "content.xml", method: 8 },
    ...extra,
  ]);
}

export const PDF = text("%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF\n");
