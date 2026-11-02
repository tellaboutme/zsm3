import fc from "fast-check";
import { describe, it } from "vitest";

import {
  chunk,
  fromBase64,
  riff,
  vp8lPayload,
  vp8Payload,
  vp8Webp,
  vp8xPayload,
} from "./webp-fixtures.ts";
import { inspectWebp, type WebpRejection } from "../../src/media/webp-inspector.ts";

const REAL_LOSSY = "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
const REAL_LOSSLESS = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
const REAL_ALPHA =
  "UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==";

function reason(bytes: Uint8Array): WebpRejection | undefined {
  const result = inspectWebp(bytes);
  return result.ok ? undefined : result.reason;
}

function withByte(bytes: Uint8Array, index: number, value: number): Uint8Array {
  const copy = Uint8Array.from(bytes);
  copy[index] = value;
  return copy;
}

describe("accepted files", () => {
  it("reads real single-pixel WebP files of every allowed layout", ({ expect }) => {
    for (const sample of [REAL_LOSSY, REAL_LOSSLESS, REAL_ALPHA]) {
      expect(inspectWebp(fromBase64(sample))).toEqual({ ok: true, width: 1, height: 1 });
    }
  });

  it("reads the dimensions of each image format", ({ expect }) => {
    const size = { ok: true, width: 1600, height: 900 };
    expect(inspectWebp(vp8Webp(1600, 900))).toEqual(size);
    expect(inspectWebp(riff([chunk("VP8L", vp8lPayload(1600, 900))]))).toEqual(size);
    for (const chunks of [
      [chunk("VP8X", vp8xPayload(1600, 900)), chunk("VP8 ", vp8Payload(1600, 900))],
      [chunk("VP8X", vp8xPayload(1600, 900)), chunk("VP8L", vp8lPayload(1600, 900))],
      [
        chunk("VP8X", vp8xPayload(1600, 900, 0x10)),
        chunk("ALPH"),
        chunk("VP8 ", vp8Payload(1600, 900)),
      ],
    ]) {
      expect(inspectWebp(riff(chunks))).toEqual(size);
    }
  });

  it("reads canvases and images wider than a byte in both axes", ({ expect }) => {
    expect(
      inspectWebp(
        riff([
          chunk("VP8X", vp8xPayload(70_000, 70_000)),
          chunk("VP8L", vp8lPayload(16_384, 16_384)),
        ]),
      ),
    ).toEqual({ ok: false, reason: "dimension-mismatch" });
    expect(
      inspectWebp(
        riff([
          chunk("VP8X", vp8xPayload(16_384, 16_384)),
          chunk("VP8L", vp8lPayload(16_384, 16_384)),
        ]),
      ),
    ).toEqual({ ok: true, width: 16_384, height: 16_384 });
  });

  it("keeps an odd chunk padded with a zero byte", ({ expect }) => {
    expect(inspectWebp(vp8Webp(10, 20, [1]))).toEqual({ ok: true, width: 10, height: 20 });
  });
});

describe("rejected containers", () => {
  it("refuses anything that is not a RIFF WebP", ({ expect }) => {
    const good = vp8Webp(10, 20);
    expect(reason(new Uint8Array(0))).toBe("not-webp");
    expect(reason(good.subarray(0, 4))).toBe("not-webp");
    expect(reason(good.subarray(0, 11))).toBe("not-webp");
    expect(reason(withByte(good, 0, 0x58))).toBe("not-webp");
    expect(reason(withByte(good, 8, 0x58))).toBe("not-webp");
    expect(reason(new TextEncoder().encode("<svg onload=alert(1)></svg>"))).toBe("not-webp");
  });

  it("requires the RIFF size to match the file exactly", ({ expect }) => {
    const good = vp8Webp(10, 20);
    expect(reason(Uint8Array.from([...good, 0, 0]))).toBe("size-mismatch");
    expect(reason(withByte(good, 4, good[4] === undefined ? 0 : good[4] + 2))).toBe(
      "size-mismatch",
    );
    expect(reason(withByte(good, 7, 0xff))).toBe("size-mismatch");
  });

  it("refuses chunks that overrun the file", ({ expect }) => {
    expect(reason(withByte(vp8Webp(10, 20), 16, 0xff))).toBe("truncated");
    const headerCut = riff([chunk("VP8 ", vp8Payload(10, 20))]).subarray(0, 18);
    const resized = withByte(headerCut, 4, 10);
    expect(reason(resized)).toBe("truncated");
    const oddCut = withByte(vp8Webp(10, 20), 16, 11);
    expect(reason(oddCut)).toBe("truncated");
  });

  it("refuses a padding byte that hides data", ({ expect }) => {
    const odd = vp8Webp(10, 20, [1]);
    expect(reason(withByte(odd, odd.length - 1, 7))).toBe("bad-padding");
  });

  it("refuses metadata, animation, colour profiles and unknown chunks", ({ expect }) => {
    for (const id of ["EXIF", "XMP ", "ANIM", "ANMF", "ICCP", "JUNK", "vp8 "]) {
      expect(reason(riff([chunk("VP8 ", vp8Payload(10, 20)), chunk(id)])), id).toBe(
        "forbidden-chunk",
      );
    }
  });

  it("reads an empty chunk at the very end of the file", ({ expect }) => {
    const empty = chunk("JUNK", new Uint8Array(0));
    expect(reason(riff([chunk("VP8 ", vp8Payload(10, 20)), empty]))).toBe("forbidden-chunk");
  });

  it("refuses every other chunk order", ({ expect }) => {
    const image = chunk("VP8 ", vp8Payload(10, 20));
    const canvas = chunk("VP8X", vp8xPayload(10, 20, 0x10));
    for (const chunks of [
      [],
      [canvas],
      [chunk("ALPH")],
      [image, image],
      [image, canvas],
      [chunk("ALPH"), image],
      [canvas, chunk("ALPH"), chunk("VP8L", vp8lPayload(10, 20))],
      [canvas, chunk("ALPH"), chunk("ALPH"), image],
    ]) {
      expect(reason(riff(chunks))).toBe("bad-structure");
    }
  });
});

describe("arbitrary input", () => {
  it("answers every byte string without throwing", ({ expect }) => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 256 }), (bytes) => {
        expect(typeof inspectWebp(bytes).ok).toBe("boolean");
      }),
    );
  });

  it("answers every mutation of a valid file without throwing", ({ expect }) => {
    const good = fromBase64(REAL_ALPHA);
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.nat(good.length - 1), fc.nat(255)), { maxLength: 8 }),
        (edits) => {
          const mutated = edits.reduce(
            (bytes, [index, value]) => withByte(bytes, index, value),
            good,
          );
          expect(typeof inspectWebp(mutated).ok).toBe("boolean");
        },
      ),
    );
  });

  it("reads back any generated size", ({ expect }) => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 0x3fff }),
        fc.integer({ min: 1, max: 0x3fff }),
        (width, height) => {
          const expected = { ok: true, width, height };
          expect(inspectWebp(vp8Webp(width, height))).toEqual(expected);
          expect(inspectWebp(riff([chunk("VP8L", vp8lPayload(width, height))]))).toEqual(expected);
        },
      ),
    );
  });
});
