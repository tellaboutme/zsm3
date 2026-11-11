import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

const WIDTHS = [360, 390, 768, 1280, 1440, 1920] as const;
const ARTICLE = "/aktualnosci/2026/dzien-patrona-szkoly-i-slubowanie-klas-pierwszych";

async function badEmailBreaks(page: Page): Promise<readonly string[]> {
  return page.locator(".site-footer a[href^='mailto:']").evaluateAll((links) =>
    links.flatMap((link) => {
      const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
      const characters: { readonly text: string; readonly top: number }[] = [];
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const value = node.textContent ?? "";
        for (let index = 0; index < value.length; index += 1) {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + 1);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0) {
            characters.push({ text: value.charAt(index), top: Math.round(rect.top) });
          }
        }
      }
      return characters.flatMap((character, index) => {
        const previous = characters[index - 1];
        if (previous === undefined || previous.top === character.top) {
          return [];
        }
        return previous.text === "@" || character.text === "." ? [] : [link.textContent.trim()];
      });
    }),
  );
}

async function linesStartingWithSeparator(page: Page): Promise<number> {
  return page.locator("nav.crumbs li").evaluateAll((items) => {
    let previousTop = Number.NEGATIVE_INFINITY;
    let count = 0;
    for (const item of items) {
      const top = Math.round(item.getBoundingClientRect().top);
      const startsLine = top > previousTop;
      const before = getComputedStyle(item, "::before").content;
      if (startsLine && before !== "none" && before !== "normal") {
        count += 1;
      }
      previousTop = top;
    }
    return count;
  });
}

for (const width of WIDTHS) {
  test(`footer e-mail addresses break only at @ or a dot at ${String(width)} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    await expect(page.locator(".site-footer a[href^='mailto:']")).toHaveCount(2);
    expect(await badEmailBreaks(page)).toEqual([]);
  });
}

test("a wrapped breadcrumb line never starts with a separator", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(ARTICLE);
  const items = page.locator("nav.crumbs li");

  await expect(items).not.toHaveCount(0);
  expect(await linesStartingWithSeparator(page)).toBe(0);
  const separators = await items.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element, "::after").content),
  );

  expect(separators.slice(0, -1).every((content) => content === '"/"')).toBe(true);
  expect(separators.at(-1)).toBe("none");
});
