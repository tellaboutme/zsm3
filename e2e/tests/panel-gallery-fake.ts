import type { Page, Route } from "@playwright/test";

export const ALBUM_ID = "018f0000-0000-7000-8000-000000000001";
const PHOTO_ID = "018f0000-0000-7000-8000-000000000002";
const AT = "2026-11-04T08:00:00.000Z";

export interface FakeAlbum {
  id: string;
  schoolYear: string;
  slug: string;
  title: string;
  description: string;
  publishedAt: string | null;
  photoCount: number;
  updatedAt: string;
}

export interface FakeGallery {
  readonly album: FakeAlbum;
  readonly photos: Record<string, unknown>[];
  readonly uploads: Buffer[];
  readonly sent: { method: string; path: string; body: unknown }[];
  uploadStatus: number;
  uploadTitle: string;
  publishStatus: number;
}

async function json(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: status >= 400 ? "application/problem+json" : "application/json",
    body: JSON.stringify(body),
  });
}

export function fakePhoto(index: number): Record<string, unknown> {
  return {
    id:
      index === 0
        ? PHOTO_ID
        : `018f0000-0000-7000-8000-0000000001${String(index).padStart(2, "0")}`,
    albumId: ALBUM_ID,
    position: index,
    width: 1600,
    height: 900,
    alt: `Opis zdjęcia ${String(index + 1)}`,
    sha256: String(index).repeat(64).slice(0, 64),
    consentBy: "galeria@zsm3.test",
    consentAt: AT,
    createdAt: AT,
  };
}

async function uploadRoute(fake: FakeGallery, route: Route): Promise<void> {
  fake.uploads.push(route.request().postDataBuffer() ?? Buffer.alloc(0));
  if (fake.uploadStatus >= 400) {
    await json(route, fake.uploadStatus, { title: fake.uploadTitle, status: fake.uploadStatus });
    return;
  }
  const item = fakePhoto(fake.photos.length);
  fake.photos.push(item);
  Object.assign(fake.album, { photoCount: fake.photos.length });
  await json(route, 201, { item, duplicate: false });
}

async function photoRoute(fake: FakeGallery, route: Route, method: string): Promise<void> {
  if (method === "DELETE") {
    fake.photos.pop();
    Object.assign(fake.album, { photoCount: fake.photos.length });
    await route.fulfill({ status: 204 });
    return;
  }
  await json(route, 200, { item: fake.photos[0] });
}

async function publishRoute(fake: FakeGallery, route: Route, body: unknown): Promise<void> {
  if (fake.publishStatus >= 400) {
    await json(route, fake.publishStatus, {
      title: "Album Has No Photos",
      status: fake.publishStatus,
    });
    return;
  }
  Object.assign(fake.album, {
    publishedAt: JSON.stringify(body).includes("unpublish") ? null : AT,
  });
  await json(route, 200, { item: fake.album });
}

async function albumRoute(fake: FakeGallery, route: Route, path: string): Promise<void> {
  const request = route.request();
  const method = request.method();
  if (path.endsWith("/photos")) {
    await uploadRoute(fake, route);
    return;
  }
  const body: unknown = method === "GET" ? undefined : request.postDataJSON();
  if (method !== "GET") {
    fake.sent.push({ method, path, body });
  }
  if (path.includes("/photos/")) {
    await photoRoute(fake, route, method);
  } else if (method === "PATCH") {
    await publishRoute(fake, route, body);
  } else if (method === "PUT") {
    Object.assign(fake.album, body);
    await json(route, 200, { item: fake.album });
  } else if (method === "DELETE") {
    await route.fulfill({ status: 204 });
  } else {
    await json(route, 200, { item: fake.album, photos: fake.photos });
  }
}

export async function fakeGallery(page: Page, role: string): Promise<FakeGallery> {
  const fake: FakeGallery = {
    album: {
      id: ALBUM_ID,
      schoolYear: "2026/2027",
      slug: "dzien-patrona",
      title: "Dzień Patrona",
      description: "",
      publishedAt: null,
      photoCount: 0,
      updatedAt: AT,
    },
    photos: [],
    uploads: [],
    sent: [],
    uploadStatus: 201,
    uploadTitle: "",
    publishStatus: 200,
  };
  await page.route("**/api/panel/me", async (route) =>
    json(route, 200, { email: "galeria@zsm3.test", role }),
  );
  await page.route(
    (url) => url.pathname.startsWith("/api/panel/albums"),
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/panel/albums") {
        if (route.request().method() === "POST") {
          fake.sent.push({
            method: "POST",
            path: url.pathname,
            body: route.request().postDataJSON(),
          });
          await json(route, 201, { item: fake.album });
          return;
        }
        await json(route, 200, { items: [fake.album] });
        return;
      }
      await albumRoute(fake, route, url.pathname);
    },
  );
  return fake;
}

const APP1_ORIENTATION_6 = [
  0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00,
  0x00, 0x08, 0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
];

export async function plainJpeg(page: Page, width: number, height: number): Promise<Buffer> {
  const bytes = await jpegBytes(page, width, height);
  return Buffer.from(bytes);
}

export async function rotatedJpeg(page: Page): Promise<Buffer> {
  const bytes = await jpegBytes(page, 800, 600);
  return Buffer.from([...bytes.slice(0, 2), ...APP1_ORIENTATION_6, ...bytes.slice(2)]);
}

async function jpegBytes(page: Page, width: number, height: number): Promise<number[]> {
  return page.evaluate(
    async ([w, h]) => {
      const canvas = new OffscreenCanvas(w, h);
      const context = canvas.getContext("2d");
      if (context === null) {
        throw new Error("no canvas");
      }
      context.fillStyle = "#0b4fb3";
      context.fillRect(0, 0, w, h);
      context.fillStyle = "#f26b1d";
      context.fillRect(0, 0, 200, 150);
      const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
      return [...new Uint8Array(await blob.arrayBuffer())];
    },
    [width, height] as const,
  );
}
