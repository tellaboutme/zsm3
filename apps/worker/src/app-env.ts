import type { RequestsSecretEnv } from "./env.ts";
import type { SqlDatabase } from "./storage/database.ts";

export interface AppEnv {
  Bindings: RequestsSecretEnv & {
    readonly DB: SqlDatabase;
    readonly SHORT_LINK_KEY?: string | undefined;
    readonly MEDIA: {
      get(key: string): Promise<{
        readonly body: ReadableStream<Uint8Array>;
        readonly size: number;
        readonly httpEtag: string;
      } | null>;
    };
  };
  Variables: { requestId: string };
}
