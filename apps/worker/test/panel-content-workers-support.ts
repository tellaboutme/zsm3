import { env } from "cloudflare:workers";

import { jsonRequest, panelOnWorkerd } from "./panel-requests-workers-support.ts";

export type Send = (method: string, path: string, body?: unknown, on?: Env) => Promise<Response>;

export interface ContentOnWorkerd {
  readonly send: Send;
  readonly pegs: string[][];
}

export async function contentOnWorkerd(): Promise<ContentOnWorkerd> {
  const pegs: string[][] = [];
  const { app, tokens } = await panelOnWorkerd({
    submit: async (urls) => {
      pegs.push([...urls]);
      return Promise.resolve(true);
    },
  });
  const send: Send = async (method, path, body, on = env) =>
    app.fetch(jsonRequest(method, path, tokens.admin, body), on);
  return { send, pegs };
}

export function interleaved(before: () => Promise<unknown>): Env {
  let pending = true;
  const DB = new Proxy(env.DB, {
    get(target, property) {
      if (property === "batch") {
        return async (statements: D1PreparedStatement[]) => {
          if (pending) {
            pending = false;
            await before();
          }
          return target.batch(statements);
        };
      }
      const value: unknown = Reflect.get(target, property, target);
      if (typeof value !== "function") {
        return value;
      }
      return (...args: unknown[]): unknown => {
        const result: unknown = Reflect.apply(value, target, args);
        return result;
      };
    },
  });
  return { ...env, DB };
}

const BODY = [{ type: "paragraph", content: [{ type: "text", text: "Relacja." }] }];

export interface ArticleCalls {
  readonly api: string;
  readonly address: string;
  readonly edit: (lead: string, expectedRevision: number | null) => unknown;
  readonly flip: (action: "publish" | "unpublish", expectedRevision: number) => unknown;
}

export function article(slug: string): ArticleCalls {
  const item = {
    slug,
    date: "2026-09-14",
    category: "Aktualnosci",
    title: "Salon Maturzystow",
    lead: "Relacja ze szkolnego Salonu Maturzystow.",
    body: BODY,
  };
  return {
    api: `/news/2026/${slug}`,
    address: `/aktualnosci/2026/${slug}`,
    edit: (lead, expectedRevision) => ({
      entity: "news",
      mutation: { action: "save", item: { ...item, lead }, expectedRevision },
    }),
    flip: (action, expectedRevision) => ({
      entity: "news",
      mutation: { action, expectedRevision },
    }),
  };
}

export interface PageCalls {
  readonly api: string;
  readonly save: (status: string, title: string, expectedRevision: number | null) => unknown;
}

export function page(path: string): PageCalls {
  return {
    api: `/pages${path}`,
    save: (status, title, expectedRevision) => ({
      entity: "pages",
      action: "save",
      page: {
        path,
        kicker: "Szkola",
        title,
        intro: "Firmy, z ktorymi pracujemy.",
        sections: [{ id: "opis", title: "Opis", blocks: [{ type: "rich-text", document: BODY }] }],
      },
      status,
      expectedRevision,
    }),
  };
}

async function total(query: string, ...values: string[]): Promise<number> {
  const row = await env.DB.prepare(query)
    .bind(...values)
    .first<{ total: number }>();
  return row?.total ?? 0;
}

export interface NewsState {
  readonly status: string;
  readonly lead: string;
  readonly audits: number;
  readonly revisions: number;
}

export async function newsState(slug: string): Promise<NewsState> {
  const row = await env.DB.prepare("SELECT status, lead FROM news WHERE slug = ?")
    .bind(slug)
    .first<{ status: string; lead: string }>();
  const id = `2026/${slug}`;
  return {
    status: row?.status ?? "missing",
    lead: row?.lead ?? "",
    audits: await total(
      "SELECT count(*) AS total FROM audit_log WHERE entity = 'news' AND entity_id = ?",
      id,
    ),
    revisions: await total(
      "SELECT count(*) AS total FROM content_revisions WHERE entity = 'news' AND entity_id = ?",
      id,
    ),
  };
}

export interface PageState {
  readonly status: string;
  readonly title: string;
  readonly revisions: number;
}

export async function pageState(path: string): Promise<PageState> {
  const row = await env.DB.prepare("SELECT status, title FROM pages WHERE path = ?")
    .bind(path)
    .first<{ status: string; title: string }>();
  return {
    status: row?.status ?? "missing",
    title: row?.title ?? "",
    revisions: await total(
      "SELECT count(*) AS total FROM content_revisions WHERE entity = 'pages' AND entity_id = ?",
      path,
    ),
  };
}
