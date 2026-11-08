import type { Page } from "@playwright/test";

export const ALBUM_PATH = "/szkola/galeria/2025-2026/przykladowy-album";

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface Geometry {
  readonly stage: Box;
  readonly image: Box;
  readonly natural: { readonly width: number; readonly height: number };
  readonly scroll: { readonly left: number; readonly top: number };
  readonly limit: { readonly left: number; readonly top: number };
  readonly zoomed: boolean;
}

async function jpeg(page: Page, width: number, height: number): Promise<Buffer> {
  const bytes = await page.evaluate(
    async ({ w, h }) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext("2d");
      if (context === null) {
        throw new Error("no canvas");
      }
      const gradient = context.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, "#1d4ed8");
      gradient.addColorStop(1, "#f97316");
      context.fillStyle = gradient;
      context.fillRect(0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.6);
      });
      if (blob === null) {
        throw new Error("no blob");
      }
      return [...new Uint8Array(await blob.arrayBuffer())];
    },
    { w: width, h: height },
  );
  return Buffer.from(bytes);
}

export async function openPhoto(page: Page, width: number, height: number): Promise<void> {
  await page.goto(ALBUM_PATH);
  const link = page.locator("a[data-gallery-photo]").first();
  const href = await link.getAttribute("href");
  const body = await jpeg(page, width, height);
  await page.route(`**${href ?? ""}`, async (route) => {
    await route.fulfill({ body, contentType: "image/jpeg" });
  });
  await link.click();
  await page.waitForFunction(
    ({ w }) => {
      const image = document.querySelector<HTMLImageElement>("[data-lightbox-image]");
      return image !== null && image.complete && image.naturalWidth === w;
    },
    { w: width },
  );
}

export async function geometry(page: Page): Promise<Geometry> {
  return page.locator("[data-lightbox-stage]").evaluate((stage) => {
    const image = stage.querySelector("img");
    if (image === null) {
      throw new Error("no image");
    }
    const box = (rect: DOMRect): Box => ({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
    const outer = stage.getBoundingClientRect();
    return {
      stage: {
        left: outer.left + stage.clientLeft,
        top: outer.top + stage.clientTop,
        width: stage.clientWidth,
        height: stage.clientHeight,
      },
      image: box(image.getBoundingClientRect()),
      natural: { width: image.naturalWidth, height: image.naturalHeight },
      scroll: { left: stage.scrollLeft, top: stage.scrollTop },
      limit: {
        left: stage.scrollWidth - stage.clientWidth,
        top: stage.scrollHeight - stage.clientHeight,
      },
      zoomed: stage.classList.contains("zoomed"),
    };
  });
}

export async function scrollStage(page: Page, left: number, top: number): Promise<void> {
  await page.locator("[data-lightbox-stage]").evaluate(
    (stage, { x, y }) => {
      stage.scrollTo({ left: x, top: y, behavior: "instant" });
    },
    { x: left, y: top },
  );
}
