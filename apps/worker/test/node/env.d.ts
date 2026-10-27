import type { MediaBucket } from "../../src/routes/panel/deps.ts";
import type { SqlDatabase } from "../../src/storage/database.ts";

declare global {
  interface Env {
    DB: SqlDatabase;
    MEDIA: MediaBucket;
    ACCESS_TEAM_DOMAIN: string;
    ACCESS_AUDIENCE: string;
    PANEL_ORIGIN: string;
  }
}
