import { MAX_PHOTO_VARIANT_BYTES, photoFieldsSchema } from "@zsm3/contracts/gallery";
import type { Context } from "hono";

import { hexDigest } from "./files.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import { variantsFit } from "../../media/photo-variants.ts";
import { inspectWebp } from "../../media/webp-inspector.ts";

const INVALID_IMAGE = "Invalid Image";

export interface PhotoUpload {
  readonly alt: string;
  readonly small: ArrayBuffer;
  readonly large: ArrayBuffer;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

async function formOf(c: Context<AppEnv>): Promise<FormData | undefined> {
  try {
    return await c.req.formData();
  } catch {
    return undefined;
  }
}

async function checkedImages(
  c: Context<AppEnv>,
  smallFile: File,
  largeFile: File,
): Promise<Response | Omit<PhotoUpload, "alt">> {
  const small = await smallFile.arrayBuffer();
  const large = await largeFile.arrayBuffer();
  const smallSize = inspectWebp(new Uint8Array(small));
  const largeSize = inspectWebp(new Uint8Array(large));
  if (!smallSize.ok || !largeSize.ok || !variantsFit(smallSize, largeSize)) {
    return problemResponse(c, 422, INVALID_IMAGE);
  }
  return {
    small,
    large,
    width: largeSize.width,
    height: largeSize.height,
    sha256: hexDigest(await crypto.subtle.digest("SHA-256", large)),
  };
}

export async function readPhotoUpload(c: Context<AppEnv>): Promise<PhotoUpload | Response> {
  const form = await formOf(c);
  if (form === undefined) {
    return problemResponse(c, 422);
  }
  const small = form.get("small");
  const large = form.get("large");
  const fields = photoFieldsSchema.safeParse({
    alt: form.get("alt"),
    consent: form.get("consent"),
  });
  if (!(small instanceof File) || !(large instanceof File) || !fields.success) {
    return problemResponse(c, 422);
  }
  if (small.size > MAX_PHOTO_VARIANT_BYTES || large.size > MAX_PHOTO_VARIANT_BYTES) {
    return problemResponse(c, 413);
  }
  const images = await checkedImages(c, small, large);
  return images instanceof Response ? images : { ...images, alt: fields.data.alt };
}
