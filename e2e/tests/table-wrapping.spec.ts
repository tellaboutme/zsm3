import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

const TABLES = [
  {
    path: "/aktualnosci/2026/tydzien-przeciwdzialania-przemocy-rowiesniczej",
    words: ["Uczestnicy"],
  },
  { path: "/kandydaci/zawody", words: ["Nauka", "Egzaminy"] },
] as const;
const WIDTHS = [360, 390, 768, 1280] as const;

async function openTables(page: Page, path: string): Promise<void> {
  await page.goto(path);
  for (const summary of await page.locator("main details:has(table) > summary").all()) {
    await summary.click();
  }
}

async function splitWords(page: Page): Promise<readonly string[]> {
  return page.locator("main table").evaluateAll((tables) => {
    const lines = (node: Text, start: number, end: number): number => {
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
    };
    const texts: Text[] = [];
    for (const table of tables) {
      const walker = document.createTreeWalker(table, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node instanceof Text; node = walker.nextNode()) {
        texts.push(node);
      }
    }
    return texts.flatMap((node) =>
      [...node.data.matchAll(/\S+/gu)]
        .filter((match) => lines(node, match.index, match.index + match[0].length) > 1)
        .map((match) => match[0]),
    );
  });
}

async function tableReach(page: Page): Promise<readonly string[]> {
  return page.locator("main table").evaluateAll((tables) =>
    tables.flatMap((table) => {
      const region = table.closest<HTMLElement>("[role=region]");
      const page = document.documentElement;
      if (page.scrollWidth > page.clientWidth) {
        return ["page scrolls sideways"];
      }
      if (table.getBoundingClientRect().width <= (table.parentElement?.clientWidth ?? 0) + 1) {
        return [];
      }
      if (region === null || getComputedStyle(region).overflowX !== "auto") {
        return ["wide table outside a scrolling region"];
      }
      return region.tabIndex >= 0 ? [] : ["scrolling region unreachable by keyboard"];
    }),
  );
}

for (const { path, words } of TABLES) {
  test.describe(path, () => {
    for (const width of WIDTHS) {
      test(`keeps table words whole at ${String(width)} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await openTables(page, path);
        for (const word of words) {
          await expect(page.locator("main table").getByText(word, { exact: true })).toBeVisible();
        }
        expect(await splitWords(page)).toEqual([]);
        await expect.poll(async () => tableReach(page)).toEqual([]);
      });
    }

    test("stays whole and reachable at 200% text on a phone", async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await openTables(page, path);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      expect(await splitWords(page)).toEqual([]);
      await expect.poll(async () => tableReach(page)).toEqual([]);
    });
  });
}

test("an unbreakable value stays inside the table's scrolling region", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openTables(page, TABLES[0].path);
  const region = page.getByRole("region", { name: "Uczestnicy turniejów" });
  await expect(region).not.toHaveAttribute("tabindex", "0");
  await page
    .locator("main table td")
    .first()
    .evaluate((cell) => {
      cell.replaceChildren("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
    });
  await expect(region).toHaveAttribute("tabindex", "0");
  expect(await tableReach(page)).toEqual([]);
  await region.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => region.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
});
