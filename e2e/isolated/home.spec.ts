import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { availablePort, command, startWorker, stopWorker, web } from "./worker.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

function addArticle(state: string, index: number): void {
  const article = `INSERT INTO news
    (id, slug, published_on, category, title, lead, body_json, status, created_at, updated_at)
    VALUES ('fixture-${String(index)}', 'fixture-${String(index)}', '2026-10-${String(20 + index)}',
    'Sport', 'Wiadomość ${String(index)}', 'Treść wiadomości',
    '[{"type":"paragraph","content":[{"type":"text","text":"Treść"}]}]', 'published',
    '2026-10-29T00:00:00Z', '2026-10-29T00:00:00Z')`;
  command(["d1", "execute", "DB", "--local", "--persist-to", state, "--command", article]);
}

function seedArticles(state: string, count: number): void {
  if (count === 1) {
    addArticle(state, 1);
  }
  if (count === 3) {
    addArticle(state, 2);
    addArticle(state, 3);
  }
}

async function verifyHome(page: Page, url: string, count: number): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  if (count === 0) {
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
  }
  const response = await page.goto(url);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Teraz w szkole" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Na skróty" }).getByRole("link")).toHaveCount(
    4,
  );
  await expect(page.locator(".hero .featured")).toHaveCount(count === 0 ? 0 : 1);
  await expect(page.locator(".news .cards > li")).toHaveCount(Math.max(0, count - 1));
  await expect(page.locator(".news")).toHaveCount(count > 1 ? 1 : 0);
  await expect(page.locator(".grid-empty")).toHaveCount(count === 0 ? 1 : 0);
  if (count === 0) {
    await verifyEmptyHome(page);
    expect(errors).toEqual([]);
  }
}

async function verifyEmptyHome(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem("zsm3.preferences", '{"text":"150"}');
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-text", "150");
  await page.evaluate(() => {
    localStorage.removeItem("zsm3.preferences");
  });
  await page.reload();
  await page.setViewportSize({ width: 180, height: 800 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    "horizontal overflow at 180px",
  ).toBe(0);
  const narrowComponentsFit = await page.evaluate(() => {
    const live = document.querySelector(".live")?.getBoundingClientRect();
    const link = document.querySelector(".live .top a")?.getBoundingClientRect();
    const progress = document.querySelector(".live progress")?.getBoundingClientRect();
    const socialLinks = [...document.querySelectorAll(".social li a")];
    return (
      live !== undefined &&
      link !== undefined &&
      progress !== undefined &&
      link.right <= live.right &&
      progress.right <= live.right &&
      socialLinks.every((item) => {
        const name = item.querySelector(".name")?.getBoundingClientRect();
        const icon = item.querySelector(".go")?.getBoundingClientRect();
        return name !== undefined && icon !== undefined && name.right <= icon.left;
      })
    );
  });
  expect(narrowComponentsFit).toBe(true);
  await page.evaluate(() => {
    localStorage.setItem("zsm3.preferences", '{"text":"150"}');
  });
  await page.reload();
  for (const width of [360, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      `horizontal overflow at ${String(width)}px`,
    ).toBe(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Teraz w szkole" })).toBeVisible();
    if (width >= 896) {
      const columns = await page
        .locator(".hero .grid")
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" "));
      expect(columns).toHaveLength(1);
    }
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.reload();
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  }
}

test("home renders zero, one and several published articles from its own D1", async ({
  page,
  request,
}) => {
  mkdirSync(join(web, ".wrangler"), { recursive: true });
  const state = mkdtempSync(join(web, ".wrangler", "home-news-"));
  let worker: ChildProcess | undefined;
  let workerError = "";
  try {
    const port = await availablePort();
    const url = `http://127.0.0.1:${String(port)}`;
    command(["d1", "migrations", "apply", "DB", "--local", "--persist-to", state]);
    worker = startWorker(state, url, port);
    const server = worker;
    if (server.stderr === null) {
      throw new Error("Isolated worker has no stderr stream");
    }
    server.stderr.on("data", (chunk: Buffer) => {
      workerError += chunk.toString();
    });
    await expect
      .poll(
        async () => {
          if (server.exitCode !== null || server.signalCode !== null) {
            throw new Error(`Isolated worker exited: ${workerError}`);
          }
          try {
            return (await request.get(`${url}/api/health`)).status();
          } catch {
            return 0;
          }
        },
        { timeout: 60_000 },
      )
      .toBe(200);

    for (const count of [0, 1, 3]) {
      seedArticles(state, count);
      await verifyHome(page, url, count);
    }
  } finally {
    try {
      if (worker !== undefined) {
        await stopWorker(worker);
      }
    } finally {
      await rm(state, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
    }
  }
});
