declare module "cloudflare:workers" {
  import type { SqlDatabase } from "@zsm3/worker/storage/database.ts";

  export const env: { readonly DB: SqlDatabase };
}
