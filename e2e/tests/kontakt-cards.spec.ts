import { expect, test } from "./fixtures.ts";

test("keeps contact e-mail links on a single line on wide screens", async ({ page, problems }) => {
  for (const width of [1280, 1920] as const) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/kontakt");
      await page.evaluate(async () => document.fonts.ready);
      const measures = await page.locator('main a[href^="mailto:"]').evaluateAll((links) =>
        links.map((link) => {
          const range = document.createRange();
          range.selectNodeContents(link);
          const lineHeight = Number.parseFloat(getComputedStyle(link).lineHeight);
          const tops = [...range.getClientRects()]
            .filter((rect) => rect.width > 0 && rect.height > 0)
            .map((rect) => rect.top)
            .toSorted((a, b) => a - b);
          const lines = tops.filter(
            (top, index) => index === 0 || top - tops[index - 1] > lineHeight / 2,
          ).length;
          return {
            lines,
            height: link.getBoundingClientRect().height,
            lineHeight,
          };
        }),
      );
      expect(measures.length).toBeGreaterThan(0);
      for (const measure of measures) {
        expect(measure.height).toBeLessThan(2 * measure.lineHeight);
        expect(measure.lines).toBe(1);
      }
    }
  }
  expect(problems).toEqual([]);
});

test("keeps the contact page inside the viewport on phones and laptops", async ({
  page,
  problems,
}) => {
  for (const width of [360, 1280] as const) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/kontakt");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    }
  }
  expect(problems).toEqual([]);
});
