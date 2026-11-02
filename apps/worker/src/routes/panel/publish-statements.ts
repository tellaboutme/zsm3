import type { News, PublicationStatus } from "@zsm3/contracts/content";

import { auditEntry } from "./audit.ts";
import type { PanelDeps, PanelSession } from "./deps.ts";
import type { NewsRef } from "./news-data.ts";
import type { SqlStatement } from "../../storage/database.ts";

export interface NewsPublication {
  readonly deps: PanelDeps;
  readonly session: PanelSession;
  readonly ref: NewsRef;
  readonly rowStatus: PublicationStatus;
  readonly previous: News;
  readonly action: "publish" | "unpublish";
  readonly status: PublicationStatus;
}

export async function publishStatements(plan: NewsPublication): Promise<readonly SqlStatement[]> {
  const { deps, session, ref, rowStatus, previous, action, status } = plan;
  return [
    deps.repos.revisions.statement(
      "news",
      ref.id,
      JSON.stringify({ ...previous, status: rowStatus }),
      session.email,
    ),
    ...(await deps.repos.news.saveStatements(previous, status)),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: `news.${action}`,
        entity: "news",
        entityId: ref.id,
        fields: ["status"],
      }),
    ),
  ];
}
