import type { Page, Route } from "@playwright/test";

export type Status = "submitted" | "in_progress" | "ready" | "collected" | "rejected" | "withdrawn";

export interface FakeRequest {
  id: string;
  type: "STUDENT_ID_RENEWAL" | "STUDENT_ID_DUPLICATE" | "ENROLLMENT_CERTIFICATE";
  status: Status;
  createdAt: string;
  updatedAt: string;
  firstName: string | null;
  lastName: string | null;
  className: string | null;
  graduationYear: number | null;
  email: string | null;
  note: string | null;
  piiErasedAt: string | null;
}

export type Transition = (
  record: FakeRequest,
  to: Status,
) => { status: number; apply: boolean } | "abort";

export interface Fake {
  readonly records: FakeRequest[];
  readonly listed: string[];
  readonly posted: { id: string; to: string; expectedStatus: string }[];
  transition: Transition;
}

const NEXT: Readonly<Record<Status, readonly Status[]>> = {
  submitted: ["in_progress", "rejected"],
  in_progress: ["ready", "rejected"],
  ready: ["collected", "rejected"],
  collected: [],
  rejected: [],
  withdrawn: [],
};

export const AT = "2026-10-22T08:00:00.000Z";

const WEBKIT_SELECT_STYLE = "console error: Refused to apply a stylesheet because its hash";

export function pageProblems(problems: readonly string[], browserName: string): readonly string[] {
  return problems.filter(
    (problem) => browserName !== "webkit" || !problem.startsWith(WEBKIT_SELECT_STYLE),
  );
}

export function fakeRequest(id: number, overrides: Partial<FakeRequest> = {}): FakeRequest {
  return {
    id: `0192f3a1-7c00-7000-8000-${String(id).padStart(12, "0")}`,
    type: "STUDENT_ID_DUPLICATE",
    status: "submitted",
    createdAt: AT,
    updatedAt: AT,
    firstName: "Anna",
    lastName: "Nowak",
    className: "2TI",
    graduationYear: null,
    email: "anna.nowak@example.com",
    note: null,
    piiErasedAt: null,
    ...overrides,
  };
}

function summary(record: FakeRequest): Record<string, string> {
  const { id, type, status, createdAt, updatedAt } = record;
  return { id, type, status, createdAt, updatedAt };
}

function newerFirst(a: FakeRequest, b: FakeRequest): number {
  const byTime = b.createdAt.localeCompare(a.createdAt);
  return byTime === 0 ? b.id.localeCompare(a.id) : byTime;
}

function olderThan(url: URL): (record: FakeRequest) => boolean {
  const before = url.searchParams.get("before");
  const beforeId = url.searchParams.get("beforeId");
  return (record) =>
    before === null ||
    record.createdAt < before ||
    (beforeId !== null && record.createdAt === before && record.id < beforeId);
}

async function json(route: Route, status: number, body: unknown): Promise<void> {
  const problem = status >= 400;
  await route.fulfill({
    status,
    contentType: problem ? "application/problem+json" : "application/json",
    body: JSON.stringify(problem ? { type: "about:blank", title: "Problem", status } : body),
  });
}

async function list(fake: Fake, route: Route, url: URL, pageSize: number): Promise<void> {
  fake.listed.push(`${url.pathname}${url.search}`);
  const status = url.searchParams.get("status");
  const rows = fake.records
    .filter((record) => status === null || record.status === status)
    .toSorted(newerFirst)
    .filter(olderThan(url));
  const items = rows.slice(0, pageSize);
  const last = items.at(-1);
  const more = rows.length > pageSize && last !== undefined;
  await json(route, 200, {
    items: items.map(summary),
    nextBefore: more ? last.createdAt : null,
    nextBeforeId: more ? last.id : null,
  });
}

async function post(fake: Fake, route: Route, record: FakeRequest): Promise<void> {
  const body: unknown = route.request().postDataJSON();
  const fields = new Map(typeof body === "object" && body !== null ? Object.entries(body) : []);
  const field = (name: string): string => String(fields.get(name) ?? "");
  const to = field("to");
  const expectedStatus = field("expectedStatus");
  fake.posted.push({ id: record.id, to, expectedStatus });
  if (expectedStatus !== record.status) {
    await json(route, 409, {});
    return;
  }
  const target = NEXT[record.status].find((status) => status === to);
  if (target === undefined) {
    await json(route, 422, {});
    return;
  }
  const outcome = fake.transition(record, target);
  if (outcome === "abort") {
    await route.abort("connectionfailed");
    return;
  }
  if (outcome.apply) {
    Object.assign(record, { status: target, updatedAt: "2026-10-24T10:00:00.000Z" });
  }
  await json(route, outcome.status, { ok: true });
}

export async function fakePanel(
  page: Page,
  role: string,
  records: FakeRequest[],
  pageSize = 2,
): Promise<Fake> {
  const fake: Fake = {
    records,
    listed: [],
    posted: [],
    transition: () => ({ status: 200, apply: true }),
  };
  await page.route("**/api/panel/me", async (route) =>
    json(route, 200, { email: "sekretariat@zsm3.local", role }),
  );
  await page.route(
    (url) => url.pathname.startsWith("/api/panel/requests"),
    async (route) => {
      const url = new URL(route.request().url());
      const [, id, action] = /^\/api\/panel\/requests(?:\/([^/]+))?(?:\/(status))?$/u.exec(
        url.pathname,
      ) ?? ["", undefined, undefined];
      if (id === undefined) {
        await list(fake, route, url, pageSize);
        return;
      }
      const record = fake.records.find((item) => item.id === id);
      if (record === undefined) {
        await json(route, 404, {});
        return;
      }
      await (action === undefined ? json(route, 200, record) : post(fake, route, record));
    },
  );
  return fake;
}
