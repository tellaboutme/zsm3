import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AppBindings, MediaBucket } from "../../app-env.ts";
import type { AccessVerifier } from "../../security/access-jwt.ts";
import type { AnnouncementsRepo } from "../../storage/announcements-repo.ts";
import type { AuditRepo } from "../../storage/audit-repo.ts";
import type { BellsRepo } from "../../storage/bells-repo.ts";
import type { SqlDatabase } from "../../storage/database.ts";
import type { DatasetsRepo } from "../../storage/datasets-repo.ts";
import type { EventsRepo } from "../../storage/events-repo.ts";
import type { FilesRepo } from "../../storage/files-repo.ts";
import type { NewsRepo } from "../../storage/news-repo.ts";
import type { PagesRepo } from "../../storage/pages-repo.ts";
import type { RedirectsRepo } from "../../storage/redirects-repo.ts";
import type { RevisionsRepo } from "../../storage/revisions-repo.ts";
import type { StaffRepo, StaffRole } from "../../storage/staff-repo.ts";

export type { MediaBucket };

export const DEFAULT_PANEL_ORIGIN = "https://zsm3.pl";

export function panelOrigin(env: AppBindings): string {
  const configured = env.PANEL_ORIGIN.trim();
  return configured.length > 0 ? configured : DEFAULT_PANEL_ORIGIN;
}

export interface PanelRepos {
  readonly staff: StaffRepo;
  readonly audit: AuditRepo;
  readonly revisions: RevisionsRepo;
  readonly news: NewsRepo;
  readonly pages: PagesRepo;
  readonly events: EventsRepo;
  readonly files: FilesRepo;
  readonly redirects: RedirectsRepo;
  readonly announcements: AnnouncementsRepo;
  readonly bells: BellsRepo;
  readonly datasets: DatasetsRepo;
}

export interface PanelSession {
  readonly email: string;
  readonly role: StaffRole;
}

export interface PanelDeps {
  readonly db: SqlDatabase;
  readonly repos: PanelRepos;
  readonly mediaBucket: MediaBucket;
  readonly origin: string;
  readonly verifier: AccessVerifier;
}

export interface PanelRuntimeEnv {
  Bindings: AppBindings;
  Variables: {
    requestId: string;
    panel?: PanelSession;
    panelDeps?: PanelDeps;
  };
}

export function requirePanelDeps(c: Context<PanelRuntimeEnv>): PanelDeps {
  const deps = c.get("panelDeps");
  if (deps === undefined) {
    throw new HTTPException(403);
  }
  return deps;
}

export function requirePanelSession(c: Context<PanelRuntimeEnv>): PanelSession {
  const session = c.get("panel");
  if (session === undefined) {
    throw new HTTPException(403);
  }
  return session;
}
