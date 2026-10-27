import type { RequestsSecretEnv } from "./env.ts";
import type { PanelDeps, PanelSession } from "./routes/panel/deps.ts";
import type { SqlDatabase } from "./storage/database.ts";

export interface MediaObject {
  readonly body: ReadableStream<Uint8Array>;
  readonly size: number;
  readonly httpEtag: string;
}

export interface MediaBucket {
  get(key: string, options?: unknown): Promise<MediaObject | null>;
  put(key: string, value: ArrayBuffer, options?: unknown): Promise<unknown>;
}

export interface AppBindings extends RequestsSecretEnv {
  readonly DB: SqlDatabase;
  readonly MEDIA: MediaBucket;
  readonly PANEL_ORIGIN: string;
  readonly ACCESS_TEAM_DOMAIN: string;
  readonly ACCESS_AUDIENCE: string;
}

export interface AppEnv {
  Bindings: AppBindings;
  Variables: {
    requestId: string;
    panel?: PanelSession;
    panelDeps?: PanelDeps;
  };
}
