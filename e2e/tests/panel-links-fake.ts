import type { Page, Route } from "@playwright/test";

export interface FakeLink {
  code: string;
  target: string | null;
  file: { name: string; format: string; bytes: number } | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  clicks: number;
  passwordProtected: boolean;
}

export interface FakeAdminLink {
  code: string;
  owner: string;
  kind: "url" | "file";
  createdAt: string;
  expiresAt: string;
  passwordProtected: boolean;
}

export interface LinksFake {
  readonly links: FakeLink[];
  readonly adminLinks: FakeAdminLink[];
  readonly adminRevoked: string[];
  readonly adminRequests: string[];
  readonly created: unknown[];
  readonly uploads: string[];
  readonly revoked: string[];
  createStatus: number;
  listStatus: number;
}

export const EXPIRY = "2027-08-31T22:00:00.000Z";

export function fakeLink(index: number, overrides: Partial<FakeLink> = {}): FakeLink {
  return {
    code: `k7mq4r${"abcdefghijk".charAt(index)}`,
    target: `https://example.org/lekcja-${String(index)}`,
    file: null,
    createdAt: `2026-11-0${String(Math.min(index + 1, 9))}T08:00:00.000Z`,
    expiresAt: EXPIRY,
    revokedAt: null,
    clicks: index,
    passwordProtected: false,
    ...overrides,
  };
}

async function json(route: Route, status: number, body: unknown): Promise<void> {
  const problem = status >= 400;
  await route.fulfill({
    status,
    contentType: problem ? "application/problem+json" : "application/json",
    body: JSON.stringify(problem ? { type: "about:blank", title: "Problem", status } : body),
  });
}

function newest(fake: LinksFake, url: URL): FakeLink[] {
  const before = url.searchParams.get("beforeCreatedAt");
  return fake.links
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((link) => before === null || link.createdAt < before);
}

async function list(fake: LinksFake, route: Route, url: URL, pageSize: number): Promise<void> {
  if (fake.listStatus !== 200) {
    await json(route, fake.listStatus, {});
    return;
  }
  const rows = newest(fake, url);
  const items = rows.slice(0, pageSize);
  const last = items.at(-1);
  const more = rows.length > pageSize && last !== undefined;
  await json(route, 200, {
    items,
    nextCursor: more ? { createdAt: last.createdAt, code: last.code } : null,
  });
}

async function create(fake: LinksFake, route: Route, file: boolean): Promise<void> {
  const request = route.request();
  if (file) {
    fake.uploads.push(request.headers()["content-type"] ?? "");
  } else {
    fake.created.push(request.postDataJSON());
  }
  if (fake.createStatus !== 201) {
    await json(route, fake.createStatus, {});
    return;
  }
  const item = fakeLink(9, {
    code: "nauka23",
    createdAt: "2026-11-09T09:00:00.000Z",
    target: file ? null : "https://example.org/nowy",
    file: file ? { name: "Karta pracy.pdf", format: "pdf", bytes: 4096 } : null,
    clicks: 0,
  });
  fake.links.push(item);
  await json(route, 201, { item });
}

async function revoke(fake: LinksFake, route: Route, code: string): Promise<void> {
  fake.revoked.push(code);
  const link = fake.links.find((item) => item.code === code && item.revokedAt === null);
  if (link === undefined) {
    await json(route, 404, {});
    return;
  }
  link.revokedAt = "2026-11-09T10:00:00.000Z";
  await route.fulfill({ status: 204 });
}

async function admin(fake: LinksFake, route: Route, code: string | undefined): Promise<void> {
  fake.adminRequests.push(route.request().method());
  if (code === undefined) {
    await json(route, 200, { items: fake.adminLinks, nextCursor: null });
    return;
  }
  fake.adminRevoked.push(code);
  const index = fake.adminLinks.findIndex((item) => item.code === code);
  if (index === -1) {
    await json(route, 404, {});
    return;
  }
  fake.adminLinks.splice(index, 1);
  await route.fulfill({ status: 204 });
}

export async function fakeLinksPanel(
  page: Page,
  role: string,
  links: FakeLink[],
  { pageSize = 20, adminLinks = [] }: { pageSize?: number; adminLinks?: FakeAdminLink[] } = {},
): Promise<LinksFake> {
  const fake: LinksFake = {
    links,
    adminLinks,
    adminRevoked: [],
    adminRequests: [],
    created: [],
    uploads: [],
    revoked: [],
    createStatus: 201,
    listStatus: 200,
  };
  await page.route("**/api/panel/me", async (route) =>
    json(route, 200, { email: "nauczyciel@zsm3.local", role }),
  );
  await page.route(
    (url) => url.pathname.startsWith("/api/panel/short-links"),
    async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const all = /^\/api\/panel\/short-links\/all(?:\/([^/]+))?$/u.exec(url.pathname);
      if (all !== null) {
        await admin(fake, route, all[1]);
        return;
      }
      const code = /^\/api\/panel\/short-links\/([^/]+)$/u.exec(url.pathname)?.[1];
      if (method === "GET") {
        await list(fake, route, url, pageSize);
        return;
      }
      if (method === "DELETE" && code !== undefined) {
        await revoke(fake, route, code);
        return;
      }
      await create(fake, route, code === "files");
    },
  );
  return fake;
}
