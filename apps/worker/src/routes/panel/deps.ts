import { indexNowHostSchema } from "@zsm3/contracts/indexnow";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AppBindings, MediaBucket } from "../../app-env.ts";
import { logEvent } from "../../logging/log.ts";
import type { AccessVerifier } from "../../security/access-jwt.ts";
import type { PiiCrypto } from "../../security/pii-crypto.ts";
import { indexNowSender, type IndexNowEndpoint } from "../../services/indexnow.ts";
import type { AnnouncementsRepo } from "../../storage/announcements-repo.ts";
import type { AuditRepo } from "../../storage/audit-repo.ts";
import type { BellsRepo } from "../../storage/bells-repo.ts";
import type { Clock, SqlDatabase } from "../../storage/database.ts";
import type { DatasetsRepo } from "../../storage/datasets-repo.ts";
import type { EventsRepo } from "../../storage/events-repo.ts";
import type { FilesRepo } from "../../storage/files-repo.ts";
import type { RandomBytes } from "../../storage/ids.ts";
import type { NewsRepo } from "../../storage/news-repo.ts";
import type { PagesRepo } from "../../storage/pages-repo.ts";
import type { RedirectsRepo } from "../../storage/redirects-repo.ts";
import type { RequestsRepo } from "../../storage/requests-repo.ts";
import type { RevisionsRepo } from "../../storage/revisions-repo.ts";
import type { ShortLinkFilesRepo } from "../../storage/short-link-files-repo.ts";
import type { ShortLinksRepo } from "../../storage/short-links-repo.ts";
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
  readonly shortLinks: ShortLinksRepo;
  readonly shortLinkFiles: ShortLinkFilesRepo;
  readonly announcements: AnnouncementsRepo;
  readonly bells: BellsRepo;
  readonly datasets: DatasetsRepo;
  readonly requests: RequestsRepo;
}

export interface PanelSession {
  readonly email: string;
  readonly role: StaffRole;
}

export type IndexNowNotify = (path: string) => Promise<boolean>;

export type BackgroundTask = (task: Promise<unknown>) => Promise<void>;

async function invalidHost(): Promise<boolean> {
  logEvent({ event: "indexnow_unavailable", errorName: "InvalidHost" });
  return Promise.resolve(false);
}

export function indexNowNotify(env: AppBindings, endpoint?: IndexNowEndpoint): IndexNowNotify {
  if (endpoint !== undefined) {
    return async (path) => endpoint.submit([path]);
  }
  const configured = env.INDEXNOW_HOST?.trim() ?? "";
  if (configured.length === 0) {
    return async () => Promise.resolve(false);
  }
  const host = indexNowHostSchema.safeParse(configured);
  if (!host.success) {
    return invalidHost;
  }
  const sender = indexNowSender(fetch, host.data);
  return async (path) => sender.submit([`https://${host.data}${path}`]);
}

export interface PanelDeps {
  readonly db: SqlDatabase;
  readonly repos: PanelRepos;
  readonly mediaBucket: MediaBucket;
  readonly clock: Clock;
  readonly random: RandomBytes;
  readonly origin: string;
  readonly verifier: AccessVerifier;
  readonly piiCrypto: PiiCrypto;
  readonly notifyIndexNow: IndexNowNotify;
  readonly defer: BackgroundTask;
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
