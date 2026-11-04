import encode from "@jsquash/webp/encode";

import {
  fitsVariantLimit,
  photoSizes,
  WEBP_QUALITIES,
  type PhotoSize,
} from "../../lib/panel/photo-sizing.ts";
import type { PhotoReply, PhotoRequest } from "../../lib/panel/photo-worker-protocol.ts";

function pixels(bitmap: ImageBitmap, { width, height }: PhotoSize): ImageData | undefined {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (context === null) {
    return undefined;
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

async function fitted(image: ImageData): Promise<ArrayBuffer | undefined> {
  for (const quality of WEBP_QUALITIES) {
    const bytes = await encode(image, { quality });
    if (fitsVariantLimit(bytes.byteLength)) {
      return bytes;
    }
  }
  return undefined;
}

async function prepared(id: number, bitmap: ImageBitmap): Promise<PhotoReply> {
  const sizes = photoSizes(bitmap);
  if (sizes === undefined) {
    return { id, ok: false, failure: "too-small" };
  }
  const smallImage = pixels(bitmap, sizes.small);
  const largeImage = pixels(bitmap, sizes.large);
  if (smallImage === undefined || largeImage === undefined) {
    return { id, ok: false, failure: "unreadable" };
  }
  const small = await fitted(smallImage);
  const large = await fitted(largeImage);
  if (small === undefined || large === undefined) {
    return { id, ok: false, failure: "too-heavy" };
  }
  return { id, ok: true, small, large };
}

async function reply({ id, file }: PhotoRequest): Promise<PhotoReply> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { id, ok: false, failure: "unreadable" };
  }
  try {
    return await prepared(id, bitmap);
  } finally {
    bitmap.close();
  }
}

addEventListener("message", (event: MessageEvent<PhotoRequest>) => {
  void reply(event.data).then((answer) => {
    postMessage(answer, { transfer: answer.ok ? [answer.small, answer.large] : [] });
  });
});
