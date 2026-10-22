import { getPlatformProxy } from "wrangler";

import { seedNews } from "./news/index.ts";
import { liveStore, type SqlDatabase } from "../src/storage/database.ts";
import { newsRepo } from "../src/storage/news-repo.ts";

const [configPath, statePath] = process.argv.slice(2);
if (configPath === undefined || statePath === undefined) {
  throw new Error("Usage: node seed/seed.ts <wrangler config> <state directory>");
}

const { env, dispose } = await getPlatformProxy<{ DB: SqlDatabase }>({
  configPath,
  persist: { path: statePath },
});
const news = newsRepo(liveStore(env.DB));
await Promise.all(seedNews.map(async (item) => news.save(item, "published")));
await dispose();
process.stdout.write(`Seeded ${String(seedNews.length)} news items.\n`);
