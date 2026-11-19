import type { Page, Route } from "@playwright/test";

export interface FeaturedRequest {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

const FEATURED_ITEM = {
  slot: "home",
  width: 1600,
  height: 900,
  alt: "Budynek szkoły od strony boiska",
  sha256: "f".repeat(64),
  photoId: "018f0000-0000-7000-8000-000000000002",
  albumId: "018f0000-0000-7000-8000-000000000001",
  albumTitle: "Dzień Patrona",
  published: true,
  updatedAt: "2026-11-04T08:00:00.000Z",
};

async function featuredRoute(
  sent: FeaturedRequest[],
  route: Route,
  items: unknown[],
): Promise<void> {
  const request = route.request();
  const method = request.method();
  const path = new URL(request.url()).pathname;
  if (method === "GET") {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items }),
    });
    return;
  }
  sent.push({ method, path, body: request.postDataJSON() });
  if (method === "DELETE") {
    items.splice(0);
    await route.fulfill({ status: 204 });
    return;
  }
  await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
}

export async function fakeFeatured(page: Page, withItem = false): Promise<FeaturedRequest[]> {
  const sent: FeaturedRequest[] = [];
  const items: unknown[] = withItem ? [FEATURED_ITEM] : [];
  await page.route(
    (url) => url.pathname.startsWith("/api/panel/featured"),
    async (route) => featuredRoute(sent, route, items),
  );
  return sent;
}
