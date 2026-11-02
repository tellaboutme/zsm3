import { newsPath } from "@zsm3/contracts/content";
import { panelMutationSchema } from "@zsm3/contracts/panel";
import type { Context } from "hono";

import { announce } from "./announce.ts";
import { auditEntry, changedFields, createdFields } from "./audit.ts";
import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { parseJsonBody } from "./http.ts";
import { newsMutation, newsPublish } from "./mutations.ts";
import { loadNews, newsRef, type NewsRef, type PanelNewsRow } from "./news-data.ts";
import { revisedNewsStatements, type NewsRevision } from "./news-statements.ts";
import { atRevision, committed, contentChanged } from "./versions.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import { newsFromRow } from "../../storage/news-repo.ts";

export async function createNews(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const save = newsMutation(await parseJsonBody(c, panelMutationSchema));
  const year = save?.item.date.slice(0, 4);
  if (save?.expectedRevision !== null || year === undefined) {
    return problemResponse(c, 422);
  }
  const { item } = save;
  const absent = async (): Promise<boolean> => (await loadNews(c, year, item.slug)) === undefined;
  if (!(await absent())) {
    return problemResponse(c, 422);
  }
  const statements = [
    ...(await deps.repos.news.createStatements(item, "draft")),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "news.create",
        entity: "news",
        entityId: `${year}/${item.slug}`,
        fields: createdFields(item),
      }),
    ),
  ];
  if (!(await committed(deps, statements, absent))) {
    return contentChanged(c);
  }
  return c.json({ ok: true, revision: 0 }, 201);
}

interface Loaded {
  readonly ref: NewsRef;
  readonly row: PanelNewsRow;
}

async function loadedAt(c: Context<AppEnv>, expected: number): Promise<Loaded | Response> {
  const ref = newsRef(c);
  const row = ref === undefined ? undefined : await loadNews(c, ref.year, ref.slug);
  if (ref === undefined || row === undefined) {
    return problemResponse(c, ref === undefined ? 422 : 404);
  }
  if (!(await atRevision(requirePanelDeps(c), "news", ref.id, expected))) {
    return contentChanged(c);
  }
  return { ref, row };
}

async function writeRevision(
  c: Context<AppEnv>,
  plan: Omit<NewsRevision, "deps" | "session">,
): Promise<Response | undefined> {
  const deps = requirePanelDeps(c);
  const statements = await revisedNewsStatements({
    ...plan,
    deps,
    session: requirePanelSession(c),
  });
  const unchanged = async (): Promise<boolean> =>
    atRevision(deps, "news", plan.ref.id, plan.expected);
  if (!(await committed(deps, statements, unchanged))) {
    return contentChanged(c);
  }
  await announce(
    deps,
    {
      before: plan.previousStatus,
      after: plan.status,
      edited: plan.fields.length > 0,
    },
    newsPath(plan.previous),
  );
  return undefined;
}

export async function updateNews(c: Context<AppEnv>): Promise<Response> {
  const save = newsMutation(await parseJsonBody(c, panelMutationSchema));
  const ref = newsRef(c);
  if (
    save === undefined ||
    save.expectedRevision === null ||
    save.item.date.slice(0, 4) !== ref?.year ||
    save.item.slug !== ref.slug
  ) {
    return problemResponse(c, 422);
  }
  const { item, expectedRevision } = save;
  const loaded = await loadedAt(c, expectedRevision);
  if (loaded instanceof Response) {
    return loaded;
  }
  const previous = newsFromRow(loaded.row);
  const failed = await writeRevision(c, {
    ref: loaded.ref,
    previous,
    previousStatus: loaded.row.status,
    next: item,
    status: loaded.row.status,
    action: "update",
    fields: changedFields(previous, item),
    expected: expectedRevision,
  });
  return failed ?? c.json({ ok: true, revision: expectedRevision + 1 });
}

export async function publishNews(c: Context<AppEnv>): Promise<Response> {
  const publish = newsPublish(await parseJsonBody(c, panelMutationSchema));
  if (publish === undefined) {
    return problemResponse(c, 422);
  }
  const loaded = await loadedAt(c, publish.expectedRevision);
  if (loaded instanceof Response) {
    return loaded;
  }
  const status = publish.action === "publish" ? "published" : "draft";
  if (loaded.row.status === status) {
    return problemResponse(c, 422, "Publication Status Unchanged");
  }
  const previous = newsFromRow(loaded.row);
  const failed = await writeRevision(c, {
    ref: loaded.ref,
    previous,
    previousStatus: loaded.row.status,
    next: previous,
    status,
    action: publish.action,
    fields: ["status"],
    expected: publish.expectedRevision,
  });
  return failed ?? c.json({ ok: true, revision: publish.expectedRevision + 1 });
}
