const END_SIGNATURE = 0x06_05_4b_50;
const CENTRAL_SIGNATURE = 0x02_01_4b_50;
const LOCAL_SIGNATURE = 0x04_03_4b_50;
const END_SIZE = 22;
const CENTRAL_SIZE = 46;
const LOCAL_SIZE = 30;
const MAX_COMMENT = 0xff_ff;
const STORED = 0;

export const MAX_ZIP_ENTRIES = 5000;

export interface StoredEntry {
  readonly name: string;
  readonly data: Uint8Array;
}

const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function decodeName(bytes: Uint8Array): string | undefined {
  try {
    return utf8.decode(bytes);
  } catch {
    return undefined;
  }
}

function findEnd(view: DataView): number | undefined {
  const last = view.byteLength - END_SIZE;
  const stop = Math.max(0, last - MAX_COMMENT);
  for (let at = last; at >= stop; at -= 1) {
    if (
      view.getUint32(at, true) === END_SIGNATURE &&
      at + END_SIZE + view.getUint16(at + 20, true) === view.byteLength
    ) {
      return at;
    }
  }
  return undefined;
}

interface Directory {
  readonly count: number;
  readonly offset: number;
  readonly end: number;
}

function startsWithEntry(view: DataView): boolean {
  return view.byteLength >= LOCAL_SIZE && view.getUint32(0, true) === LOCAL_SIGNATURE;
}

function directoryOf(view: DataView): Directory | undefined {
  const end = startsWithEntry(view) ? findEnd(view) : undefined;
  if (end === undefined) {
    return undefined;
  }
  const count = view.getUint16(end + 10, true);
  const singleDisk =
    view.getUint16(end + 4, true) === 0 &&
    view.getUint16(end + 6, true) === 0 &&
    view.getUint16(end + 8, true) === count;
  const offset = view.getUint32(end + 16, true);
  const bounded = offset + view.getUint32(end + 12, true) === end;
  return singleDisk && bounded && count > 0 && count <= MAX_ZIP_ENTRIES
    ? { count, offset, end }
    : undefined;
}

export function zipNames(bytes: Uint8Array): readonly string[] | undefined {
  const view = viewOf(bytes);
  const directory = directoryOf(view);
  if (directory === undefined) {
    return undefined;
  }
  const names: string[] = [];
  let at = directory.offset;
  for (let index = 0; index < directory.count; index += 1) {
    if (at + CENTRAL_SIZE > directory.end || view.getUint32(at, true) !== CENTRAL_SIGNATURE) {
      return undefined;
    }
    const nameEnd = at + CENTRAL_SIZE + view.getUint16(at + 28, true);
    const next = nameEnd + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    const name =
      next > directory.end ? undefined : decodeName(bytes.subarray(at + CENTRAL_SIZE, nameEnd));
    if (name === undefined) {
      return undefined;
    }
    names.push(name);
    at = next;
  }
  return at === directory.end ? names : undefined;
}

export function storedFirstEntry(bytes: Uint8Array): StoredEntry | undefined {
  const view = viewOf(bytes);
  if (
    bytes.byteLength < LOCAL_SIZE ||
    view.getUint32(0, true) !== LOCAL_SIGNATURE ||
    view.getUint16(8, true) !== STORED
  ) {
    return undefined;
  }
  const nameEnd = LOCAL_SIZE + view.getUint16(26, true);
  const start = nameEnd + view.getUint16(28, true);
  const finish = start + view.getUint32(18, true);
  const name =
    finish > bytes.byteLength ? undefined : decodeName(bytes.subarray(LOCAL_SIZE, nameEnd));
  return name === undefined ? undefined : { name, data: bytes.subarray(start, finish) };
}
