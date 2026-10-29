interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUDIENCE: string;
  PANEL_ORIGIN: string;
  SHORT_LINK_KEY?: string;
}
