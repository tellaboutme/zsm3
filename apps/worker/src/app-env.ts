import type { RequestsSecretEnv } from "./env.ts";
import type { PanelDeps, PanelSession } from "./routes/panel/deps.ts";
import type { SqlDatabase } from "./storage/database.ts";

export interface AppBindings extends RequestsSecretEnv {
  readonly DB: SqlDatabase;
  readonly MEDIA: {
    get(
      key: string,
      options?: unknown,
    ): Promise<{
      readonly body: ReadableStream<Uint8Array>;
      readonly size: number;
      readonly httpEtag: string;
    } | null>;
    put(key: string, value: ArrayBuffer, options?: unknown): Promise<unknown>;
  };
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
