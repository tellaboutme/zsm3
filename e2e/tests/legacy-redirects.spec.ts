import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { expect, test } from "./fixtures.ts";

test.describe.configure({ mode: "serial" });

const web = new URL("../../apps/web/", import.meta.url);
const wrangler = new URL("../../apps/web/node_modules/wrangler/bin/wrangler.js", import.meta.url);
const runId = randomUUID();
let project = "";
let inserted = false;

function legacyPath(name: string): string {
  return `/e2e-${project}-${runId}-${name}`;
}

function rows(): readonly (readonly [string, string])[] {
  return [
    [legacyPath("old"), legacyPath("hop")],
    [legacyPath("hop"), "/"],
    [legacyPath("cycle-a"), legacyPath("cycle-b")],
    [legacyPath("cycle-b"), legacyPath("cycle-a")],
    [legacyPath("unsafe"), "//evil.test"],
    [legacyPath("missing-target"), legacyPath("not-a-page")],
    [legacyPath("wordpress.php"), "/"],
    [legacyPath("missing.ico"), "/"],
    [legacyPath("missing.css"), "/"],
    [`/panel${legacyPath("reserved")}`, "/"],
    [`/_astro${legacyPath("reserved")}.js`, "/"],
  ];
}

async function executeSql(sql: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      execFileSync(
        process.execPath,
        [
          fileURLToPath(wrangler),
          "d1",
          "execute",
          "DB",
          "--local",
          "--persist-to",
          ".wrangler/state",
          "--command",
          sql,
        ],
        { cwd: web, stdio: "pipe" },
      );
      return;
    } catch (error) {
      if (attempt === 4) {
        throw error;
      }
      await setTimeout(200 * (attempt + 1));
    }
  }
}

test.beforeAll(async ({ request }, testInfo) => {
  expect((await request.get("/api/health")).status()).toBe(200);
  project = testInfo.project.name.replace(/[^a-z0-9-]/gu, "-");
  await executeSql(
    `INSERT INTO redirects (from_path, to_path, created_at) VALUES ${rows()
      .map(([from, to]) => `('${from}', '${to}', '2026-10-26T00:00:00Z')`)
      .join(", ")} ON CONFLICT(from_path) DO NOTHING`,
  );
  inserted = true;
});

test.afterAll(async () => {
  if (inserted) {
    await executeSql(
      `DELETE FROM redirects WHERE from_path IN (${rows()
        .map(([from]) => `'${from}'`)
        .join(", ")})`,
    );
  }
});

test("redirects missing public GET and HEAD with page security headers", async ({ request }) => {
  for (const method of ["GET", "HEAD"]) {
    const response = await request.fetch(`${legacyPath("old")}?tracking=1`, {
      method,
      maxRedirects: 0,
    });
    expect(response.status()).toBe(301);
    expect(response.headers()["location"]).toBe("/");
    expect(response.headers()["strict-transport-security"]).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(response.headers()["content-security-policy"]).toContain("default-src 'none'");
    expect(response.headers()["cache-control"]).toBe("public, max-age=0, must-revalidate");
    expect((await response.body()).length).toBe(0);
  }
  expect((await request.get(legacyPath("wordpress.php"), { maxRedirects: 0 })).status()).toBe(301);
});

test("keeps cycles, unsafe and missing targets as the original 404", async ({ request }) => {
  for (const path of [
    legacyPath("cycle-a"),
    legacyPath("unsafe"),
    legacyPath("missing-target"),
    legacyPath("absent"),
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain("Nie znaleziono strony");
  }
});

test("does not override pages, static files, API, panel, or other methods", async ({ request }) => {
  expect((await request.get("/kontakt", { maxRedirects: 0 })).status()).toBe(200);
  expect((await request.get("/robots.txt", { maxRedirects: 0 })).status()).toBe(200);
  expect((await request.get("/api/health", { maxRedirects: 0 })).status()).toBe(200);
  for (const path of [
    legacyPath("missing.ico"),
    legacyPath("missing.css"),
    `/panel${legacyPath("reserved")}`,
    `/_astro${legacyPath("reserved")}.js`,
  ]) {
    expect((await request.get(path, { maxRedirects: 0 })).status()).toBe(404);
  }
  expect((await request.post(legacyPath("old"), { maxRedirects: 0 })).status()).toBe(405);
});
