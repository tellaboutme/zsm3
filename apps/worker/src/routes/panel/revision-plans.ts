import {
  contentPageSchema,
  newsPath,
  newsSchema,
  type PublicationStatus,
} from "@zsm3/contracts/content";
import { datasetKeySchema, datasetSchemas } from "@zsm3/contracts/datasets";
import type { PanelRevisionRestore, RevisionTarget } from "@zsm3/contracts/revisions";
import type { Context } from "hono";
import { z } from "zod";

import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { loadNews } from "./news-data.ts";
import type { AppEnv } from "../../app-env.ts";
import { firstRow, type SqlStatement, type WriteReceipt } from "../../storage/database.ts";
import { newsFromRow } from "../../storage/news-repo.ts";
import { pageFromRow } from "../../storage/pages-repo.ts";

const PAGE_ONE =
  "SELECT path, kicker, title, intro, sections_json, status FROM pages WHERE path = ?";

const pageRowSchema = z.object({
  path: z.string(),
  kicker: z.string(),
  title: z.string(),
  intro: z.string(),
  sections_json: z.string(),
  status: z.enum(["draft", "published"]),
});

const revisedNewsSchema = z.object(newsSchema.shape);

const revisedPageSchema = z.object(contentPageSchema.shape);

const NEWS_ID = /^(?<year>\d{4})\/(?<slug>[a-z0-9-]+)$/u;

export interface PublicAddress {
  readonly path: string;
  readonly status: PublicationStatus;
}

export interface RestorePlan {
  readonly before: object;
  readonly after: object;
  readonly receipt: WriteReceipt;
  readonly writes: readonly SqlStatement[];
  readonly address?: PublicAddress;
}

async function newsPlan(
  c: Context<AppEnv>,
  restore: PanelRevisionRestore,
  data: unknown,
): Promise<RestorePlan | number> {
  const deps = requirePanelDeps(c);
  const ref = NEWS_ID.exec(restore.id)?.groups;
  const item = revisedNewsSchema.safeParse(data);
  if (ref === undefined || !item.success) {
    return 422;
  }
  const restored = item.data;
  const row = await loadNews(c, String(ref["year"]), String(ref["slug"]));
  if (row === undefined) {
    return 404;
  }
  if (restored.slug !== row.slug || restored.date.slice(0, 4) !== row.published_on.slice(0, 4)) {
    return 422;
  }
  const current = newsFromRow(row);
  return {
    before: current,
    after: restored,
    receipt: deps.repos.revisions.expectedWrite({
      entity: "news",
      entityId: restore.id,
      dataJson: JSON.stringify({ ...current, status: row.status }),
      actorEmail: requirePanelSession(c).email,
      expected: restore.expectedRevision,
    }),
    writes: await deps.repos.news.saveStatements(restored, row.status),
    address: { path: newsPath(current), status: row.status },
  };
}

async function pagePlan(
  c: Context<AppEnv>,
  restore: PanelRevisionRestore,
  data: unknown,
): Promise<RestorePlan | number> {
  const deps = requirePanelDeps(c);
  const item = revisedPageSchema.safeParse(data);
  if (!item.success || item.data.path !== restore.id) {
    return 422;
  }
  const restored = item.data;
  const row = await firstRow(deps.db.prepare(PAGE_ONE).bind(restore.id), pageRowSchema);
  if (row === undefined) {
    return 404;
  }
  const current = pageFromRow(row);
  return {
    before: current,
    after: restored,
    receipt: deps.repos.revisions.expectedWrite({
      entity: "pages",
      entityId: restore.id,
      dataJson: JSON.stringify({ ...current, status: row.status }),
      actorEmail: requirePanelSession(c).email,
      expected: restore.expectedRevision,
    }),
    writes: deps.repos.pages.saveStatements(restored, row.status),
    address: { path: current.path, status: row.status },
  };
}

async function datasetPlan(
  c: Context<AppEnv>,
  restore: PanelRevisionRestore,
  data: unknown,
): Promise<RestorePlan | number> {
  const deps = requirePanelDeps(c);
  const key = datasetKeySchema.safeParse(restore.id);
  if (!key.success || !datasetSchemas[key.data].safeParse(data).success) {
    return 422;
  }
  const current = await deps.repos.datasets.get(key.data);
  if (current === undefined) {
    return 404;
  }
  return {
    before: { [key.data]: current.data },
    after: { [key.data]: data },
    receipt: deps.repos.revisions.expectedWrite({
      entity: "datasets",
      entityId: key.data,
      dataJson: JSON.stringify(current.data),
      actorEmail: requirePanelSession(c).email,
      expected: restore.expectedRevision,
    }),
    writes: [deps.repos.datasets.saveStatement(key.data, data)],
  };
}

export const RESTORE_PLANS: Readonly<
  Record<
    RevisionTarget,
    (
      c: Context<AppEnv>,
      restore: PanelRevisionRestore,
      data: unknown,
    ) => Promise<RestorePlan | number>
  >
> = { news: newsPlan, pages: pagePlan, datasets: datasetPlan };
