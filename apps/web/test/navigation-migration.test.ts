import { readFileSync } from "node:fs";

import { it } from "vitest";

import { fallbackNavigation } from "../src/data/navigation.ts";

const MIGRATION = new URL("../../worker/migrations/0012_navigation.sql", import.meta.url);

it("ships the bundled navigation in the migration", ({ expect }) => {
  const sql = readFileSync(MIGRATION, "utf8");
  const json = /\('nawigacja', '(?<data>.+)', '/su.exec(sql)?.groups?.["data"] ?? "null";
  expect(JSON.parse(json.replaceAll("''", "'"))).toEqual(fallbackNavigation);
});
