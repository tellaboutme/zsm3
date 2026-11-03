import type { Page, Route } from "@playwright/test";

export type QuestionStatus = "received" | "draft" | "published" | "rejected" | "withdrawn";

export interface FakeQuestion {
  id: string;
  addressee: "pedagogue" | "psychologist" | "leadership";
  status: QuestionStatus;
  version: number;
  receivedOn: string;
  question: string | null;
  draft: { question: string; answer: string } | null;
  published: { slug: string; publishedOn: string } | null;
}

export interface QuestionsFake {
  readonly items: FakeQuestion[];
  readonly writes: { path: string; body: unknown }[];
  conflict: boolean;
}

export const HOSTILE = "<img src=x onerror=\"document.title='zhakowane'\"> Czy ktoś mi pomoże?";

export function fakeQuestion(n: number, overrides: Partial<FakeQuestion> = {}): FakeQuestion {
  return {
    id: `5e1d0000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    addressee: "pedagogue",
    status: "received",
    version: 1,
    receivedOn: `2026-10-${String(10 + n).padStart(2, "0")}`,
    question: HOSTILE,
    draft: null,
    published: null,
    ...overrides,
  };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: status === 200 ? "application/json" : "application/problem+json",
    body: JSON.stringify(body),
  });
}

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function apply(item: FakeQuestion, path: string, body: unknown): void {
  const target = item;
  target.version += 1;
  if (path.endsWith("/draft")) {
    target.status = "draft";
    target.draft = {
      question: String(field(body, "question")),
      answer: String(field(body, "answer")),
    };
    return;
  }
  const action = field(body, "action");
  if (action === "publish") {
    target.status = "published";
    target.question = null;
    target.published = { slug: "abcdefghjkmn", publishedOn: "2026-10-22" };
  } else if (action === "reject") {
    target.status = "rejected";
  } else if (action === "withdraw") {
    target.status = "withdrawn";
    target.published = null;
  }
}

async function write(route: Route, fake: QuestionsFake): Promise<void> {
  const path = new URL(route.request().url()).pathname;
  const body: unknown = route.request().postDataJSON();
  fake.writes.push({ path, body });
  const item = fake.items.find((candidate) => path.includes(candidate.id));
  if (item === undefined) {
    await json(route, { type: "about:blank", title: "Not Found", status: 404 }, 404);
    return;
  }
  if (fake.conflict || field(body, "expectedVersion") !== item.version) {
    item.version += fake.conflict ? 1 : 0;
    await json(route, { type: "about:blank", title: "Question Changed", status: 409 }, 409);
    return;
  }
  apply(item, path, body);
  await json(route, { ok: true, version: item.version });
}

export async function fakeQuestionsPanel(
  page: Page,
  role: string,
  items: FakeQuestion[],
): Promise<QuestionsFake> {
  const fake: QuestionsFake = { items, writes: [], conflict: false };
  await page.route("**/api/panel/me", async (route) =>
    json(route, { email: "pedagog@zsm3.local", role }),
  );
  await page.route("**/api/panel/questions**", async (route) => {
    if (route.request().method() !== "GET") {
      await write(route, fake);
      return;
    }
    const url = new URL(route.request().url());
    const match = fake.items.find((item) => url.pathname.endsWith(item.id));
    if (match !== undefined) {
      await json(route, { ...match, history: [] });
      return;
    }
    const status = url.searchParams.get("status");
    const listed = fake.items.filter((item) => status === null || item.status === status);
    await json(route, {
      items: listed.map(({ id, addressee, status: state, version, receivedOn }) => ({
        id,
        addressee,
        status: state,
        version,
        receivedOn,
      })),
      nextBefore: null,
      nextBeforeId: null,
    });
  });
  return fake;
}
