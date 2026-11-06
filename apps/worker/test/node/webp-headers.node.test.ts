import { describe, it } from "vitest";

import { chunk, riff, vp8lPayload, vp8Payload, vp8Webp, vp8xPayload } from "./webp-fixtures.ts";
import { inspectWebp, type WebpRejection } from "../../src/media/webp-inspector.ts";

function reason(bytes: Uint8Array): WebpRejection | undefined {
  const result = inspectWebp(bytes);
  return result.ok ? undefined : result.reason;
}

function withByte(bytes: Uint8Array, index: number, value: number): Uint8Array {
  const copy = Uint8Array.from(bytes);
  copy[index] = value;
  return copy;
}

describe("rejected image headers", () => {
  function vp8With(index: number, value: number): Uint8Array {
    return riff([chunk("VP8 ", withByte(vp8Payload(10, 20), index, value))]);
  }

  it("refuses a broken VP8 frame", ({ expect }) => {
    expect(reason(riff([chunk("VP8 ", new Uint8Array(9))]))).toBe("bad-header");
    expect(reason(vp8With(0, 0x11))).toBe("bad-header");
    expect(reason(vp8With(3, 0))).toBe("bad-header");
    expect(reason(vp8With(4, 0))).toBe("bad-header");
    expect(reason(vp8With(5, 0))).toBe("bad-header");
    expect(reason(vp8With(1, 1))).toBe("bad-header");
    expect(reason(vp8With(2, 1))).toBe("bad-header");
  });

  it("refuses zero and scaled VP8 dimensions", ({ expect }) => {
    expect(reason(vp8Webp(0, 20))).toBe("bad-header");
    expect(reason(vp8Webp(10, 0))).toBe("bad-header");
    expect(reason(vp8Webp(0x4000, 20))).toBe("bad-header");
    expect(reason(vp8Webp(10, 0x4000))).toBe("bad-header");
    expect(inspectWebp(vp8Webp(0x3fff, 0x3fff))).toEqual({
      ok: true,
      width: 0x3fff,
      height: 0x3fff,
    });
  });

  it("accepts a partition that exactly fills the frame", ({ expect }) => {
    const payload = vp8Payload(10, 20, [1, 1]);
    expect(inspectWebp(riff([chunk("VP8 ", withByte(payload, 0, 0x40))]))).toEqual({
      ok: true,
      width: 10,
      height: 20,
    });
    expect(reason(riff([chunk("VP8 ", withByte(payload, 0, 0x60))]))).toBe("bad-header");
  });

  it("counts the third byte of the frame tag", ({ expect }) => {
    const filler = new Array<number>(2048).fill(0);
    const payload = withByte(withByte(vp8Payload(10, 20, filler), 0, 0), 2, 1);
    expect(inspectWebp(riff([chunk("VP8 ", payload)]))).toEqual({
      ok: true,
      width: 10,
      height: 20,
    });
  });

  it("refuses a broken VP8L header", ({ expect }) => {
    const good = vp8lPayload(10, 20);
    expect(reason(riff([chunk("VP8L", Uint8Array.of(0x2f, 0, 0, 0))]))).toBe("bad-header");
    expect(reason(riff([chunk("VP8L", new Uint8Array(4))]))).toBe("bad-header");
    expect(reason(riff([chunk("VP8L", withByte(good, 0, 0x2e))]))).toBe("bad-header");
    expect(reason(riff([chunk("VP8L", withByte(good, 4, 0x20))]))).toBe("bad-header");
  });

  it("refuses a VP8X canvas with hidden features or the wrong size", ({ expect }) => {
    const image = chunk("VP8 ", vp8Payload(10, 20));
    const canvas = (payload: Uint8Array): Uint8Array => riff([chunk("VP8X", payload), image]);
    expect(reason(canvas(new Uint8Array(9)))).toBe("bad-header");
    for (const flags of [0x01, 0x02, 0x04, 0x08, 0x20, 0x40, 0x80, 0x12]) {
      expect(reason(canvas(vp8xPayload(10, 20, flags))), String(flags)).toBe("bad-header");
    }
    for (const index of [1, 2, 3]) {
      expect(reason(canvas(withByte(vp8xPayload(10, 20), index, 1)))).toBe("bad-header");
    }
    expect(reason(riff([chunk("VP8X", vp8xPayload(10, 20)), chunk("ALPH"), image]))).toBe(
      "bad-header",
    );
    expect(reason(canvas(vp8xPayload(11, 20)))).toBe("dimension-mismatch");
    expect(reason(canvas(vp8xPayload(10, 21)))).toBe("dimension-mismatch");
  });
});
