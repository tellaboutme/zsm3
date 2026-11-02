import type { News, PublicationStatus } from "@zsm3/contracts/content";

import { auditEntry } from "./audit.ts";
import type { PanelDeps, PanelSession } from "./deps.ts";
import type { NewsRef } from "./news-data.ts";
import type { SqlStatement } from "../../storage/database.ts";

export interface NewsRevision {
  readonly deps: PanelDeps;
  readonly session: PanelSession;
  readonly ref: NewsRef;
  readonly previous: News;
  readonly previousStatus: PublicationStatus;
  readonly next: News;
  readonly status: PublicationStatus;
  readonly action: "update" | "publish" | "unpublish";
  readonly fields: readonly string[];
  readonly expected: number;
}

export async function revisedNewsStatements(plan: NewsRevision): Promise<readonly SqlStatement[]> {
  const { deps, session, ref, previous, previousStatus, next, status, action, fields } = plan;
  return [
    deps.repos.revisions.expectedStatement({
      entity: "news",
      entityId: ref.id,
      dataJson: JSON.stringify({ ...previous, status: previousStatus }),
      actorEmail: session.email,
      expected: plan.expected,
    }),
    ...(await deps.repos.news.saveStatements(next, status)),
    deps.repos.audit.statement(
      auditEntry({ session, action: `news.${action}`, entity: "news", entityId: ref.id, fields }),
    ),
  ];
}
