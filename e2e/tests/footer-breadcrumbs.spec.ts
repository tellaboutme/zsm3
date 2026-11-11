import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

const WIDTHS = [360, 390, 768, 1280, 1440, 1920] as const;
const ARTICLE = "/aktualnosci/2026/dzien-patrona-szkoly-i-slubowanie-klas-pierwszych";

async function badEmailBreaks(page: Page, scope: string): Promise<readonly string[]> {
  return page.locator(`${scope} a[href^='mailto:']`).evaluateAll((links) =>
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
      const at = characters.findIndex((character) => character.text === "@");
      return characters.flatMap((character, index) => {
        const previous = characters[index - 1];
        if (previous === undefined || previous.top === character.top) {
          return [];
        }
        const allowed = index === at + 1 || (at >= 0 && index > at && character.text === ".");
        return allowed ? [] : [link.textContent.trim()];
      });
    }),
  );
}

async function separatorsOnNewLines(page: Page): Promise<number> {
  return page.locator("nav.crumbs li:not(:last-child)").evaluateAll(
    (items) =>
      items.filter((item) => {
        const link = item.querySelector("a");
        return (
          link !== null &&
          item.getBoundingClientRect().height > link.getBoundingClientRect().height + 1
        );
      }).length,
  );
}

for (const width of WIDTHS) {
  test(`e-mail addresses break only after @ or before a domain dot at ${String(width)} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/kontakt");

    await expect(page.locator(".site-footer a[href^='mailto:']")).toHaveCount(2);
    expect(await badEmailBreaks(page, ".site-footer")).toEqual([]);
    expect(await badEmailBreaks(page, "main")).toEqual([]);
  });
}

test("a breadcrumb separator never wraps away from its item", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(ARTICLE);
  const items = page.locator("nav.crumbs li");

  await expect(items).not.toHaveCount(0);
  expect(await separatorsOnNewLines(page)).toBe(0);
  const separators = await items.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element, "::after").content),
  );

  expect(separators.slice(0, -1).every((content) => content === '"/"')).toBe(true);
  expect(["none", "normal", ""]).toContain(separators.at(-1));
});
