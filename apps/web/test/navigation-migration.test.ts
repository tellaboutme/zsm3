import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { it } from "vitest";

import { fallbackNavigation } from "../src/data/navigation.ts";

function navigationMigration(): string {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (directory !== dirname(directory)) {
    if (existsSync(join(directory, "pnpm-workspace.yaml"))) {
      return join(directory, "apps/worker/migrations/0012_navigation.sql");
    }
    directory = dirname(directory);
  }
  throw new Error("Workspace navigation migration not found");
}

it("ships the bundled navigation in the migration", ({ expect }) => {
  const sql = readFileSync(navigationMigration(), "utf8");
  const json = /\('nawigacja', '(?<data>.+)', '/su.exec(sql)?.groups?.["data"] ?? "null";
  expect(JSON.parse(json.replaceAll("''", "'"))).toEqual(fallbackNavigation);
});
