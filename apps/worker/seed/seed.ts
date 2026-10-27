import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { getPlatformProxy } from "wrangler";

import { seedBells } from "./bells.ts";
import { seedSchoolYear } from "./calendar/index.ts";
import { seedFiles, storedFile, type SeedFile } from "./files.ts";
import { seedNews } from "./news/index.ts";
import { seedPages } from "./pages/index.ts";
import { seedRequests } from "./requests.ts";
import { seedShortLinks } from "./short-links.ts";
import { seedStaff } from "./staff.ts";
import { MissingSecretError, requestsConfig, type RequestsSecretEnv } from "../src/env.ts";
import { piiCrypto } from "../src/security/pii-crypto.ts";
import { bellsRepo } from "../src/storage/bells-repo.ts";
import { liveStore, type SqlDatabase } from "../src/storage/database.ts";
import { filesRepo } from "../src/storage/files-repo.ts";
import { newsRepo } from "../src/storage/news-repo.ts";
import { pagesRepo } from "../src/storage/pages-repo.ts";
import { staffRepo } from "../src/storage/staff-repo.ts";

interface MediaBucket {
  put(key: string, value: Uint8Array): Promise<unknown>;
}

const SIBLING_MEDIA = fileURLToPath(new URL("../../../../zsm3_media/", import.meta.url));

function mediaDirectoryFrom(argument: string | undefined): string | undefined {
  const chosen = argument ?? process.env["ZSM3_MEDIA"];
  if (chosen !== undefined) {
    return chosen;
  }
  return existsSync(SIBLING_MEDIA) ? SIBLING_MEDIA : undefined;
}

const [configPath, statePath, mediaArgument] = process.argv.slice(2);
const mediaDirectory = mediaDirectoryFrom(mediaArgument);
if (configPath === undefined || statePath === undefined) {
  throw new Error("Usage: node seed/seed.ts <wrangler config> <state directory> [media directory]");
}

async function verifiedBytes(directory: string, file: SeedFile): Promise<Uint8Array> {
  const bytes = await readFile(join(directory, `${file.sha256}.${file.format}`));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== file.sha256 || bytes.byteLength !== file.bytes) {
    throw new Error(`${file.name} does not match the manifest`);
  }
  return bytes;
}

const { env, dispose } = await getPlatformProxy<
  { DB: SqlDatabase; MEDIA: MediaBucket; SHORT_LINK_KEY?: string } & RequestsSecretEnv
>({
  configPath,
  persist: { path: statePath },
});
const store = liveStore(env.DB);
const news = newsRepo(store);
const pages = pagesRepo(store);
const files = filesRepo(store);
const staff = staffRepo(store);
const manifest = Object.values(seedFiles);
await Promise.all([
  ...seedNews.map(async (item) => news.save(item, "published")),
  ...seedPages.map(async (page) => pages.save(page, "published")),
  ...manifest.map(async (file) => files.save(storedFile(file))),
  ...seedStaff.map(async (member) => staff.save(member)),
  bellsRepo(store).saveStatement(seedBells(new Date(), seedSchoolYear)).run(),
]);
if (mediaDirectory !== undefined) {
  for (const file of manifest) {
    await env.MEDIA.put(storedFile(file).key, await verifiedBytes(mediaDirectory, file));
  }
}
const seededLinks = await seedShortLinks(store, env.SHORT_LINK_KEY);
let seededRequests = 0;
let requestsAvailable = true;
try {
  const config = requestsConfig(env);
  seededRequests = await seedRequests({
    store,
    pii: piiCrypto(config.piiKeys, config.activePiiKeyId, store.random),
    emailIndexKey: config.emailIndexKey,
  });
} catch (error) {
  if (!(error instanceof MissingSecretError)) {
    throw error;
  }
  requestsAvailable = false;
}
await dispose();
process.stdout.write(
  `Seeded ${String(seedNews.length)} news items, ${String(seedPages.length)} pages, ${String(seedStaff.length)} staff accounts, ${String(manifest.length)} files${mediaDirectory === undefined ? " without their contents" : ""} and ${String(seededLinks)} short links.${
    requestsAvailable
      ? ` Seeded ${String(seededRequests)} e-wniosek requests.`
      : " Skipped e-wniosek requests (missing secrets)."
  }\n`,
);
