import type { ConsoleMessage, Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

const PROBLEM = {
  type: "about:blank",
  title: "Brak dostępu",
  status: 401,
};

const MISSING_DOCUMENT = "Failed to load resource: the server responded with a status of 404";
const PANEL_BLOCKED = "Failed to load resource: the server responded with a status of 401";

function report(message: ConsoleMessage, page: Page): string | undefined {
  const text = message.text();
  const url = message.location().url;
  if (text.startsWith(MISSING_DOCUMENT) && url === page.url()) {
    return undefined;
  }
  if (text.startsWith(PANEL_BLOCKED) && url.includes("/api/panel")) {
    return undefined;
  }
  return `console ${message.type()}: ${text}`;
}

function listen(page: Page): readonly string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") {
      return;
    }
    const entry = report(message, page);
    if (entry !== undefined) {
      problems.push(entry);
    }
  });
  return problems;
}

test.describe("panel sign-in gate", () => {
  test.use({ viewport: { width: 360, height: 740 } });
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "The panel serves this browser first.",
  );

  test("screens anonymous visitors on a narrow phone screen", async ({ page }) => {
    const problems = listen(page);
    await page.route("**/api/panel/me", async (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/problem+json",
        body: JSON.stringify(PROBLEM),
      }),
    );

    await page.goto("/panel");

    const gate = page.locator('[data-panel="gate"]');
    await expect(gate).toBeVisible();
    await expect(gate).toContainText("Ten panel wymaga zalogowania przez Cloudflare Access.");
    await expect(gate).toContainText(
      "Zaloguj się szkolnym kontem na stronie logowania i otwórz panel ponownie.",
    );
    await expect(page.locator('[data-panel="app"]')).toBeHidden();

    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(360);
    expect(problems).toEqual([]);
  });
});
