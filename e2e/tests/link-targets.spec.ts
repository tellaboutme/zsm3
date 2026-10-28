import { expect, test } from "./fixtures.ts";

test("secondary links offer separate touch targets on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });

    for (const path of ["/", "/kontakt"]) {
      await page.goto(path);
      const selector = path === "/" ? ".head .more, .site-footer a" : ".crumbs a, .site-footer a";
      const targets = await page.locator(selector).evaluateAll((links) =>
        links
          .filter((link) => link.getBoundingClientRect().width > 0)
          .map((link) => {
            const { width, height } = link.getBoundingClientRect();
            return { width, height };
          }),
      );

      expect(targets.length).toBeGreaterThan(0);
      for (const target of targets) {
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
      }
      const overlap = await page.locator(".site-footer li + li").evaluateAll((items) =>
        items.some((item) => {
          const previous = item.previousElementSibling?.querySelector("a");
          const current = item.querySelector("a");
          return (
            previous instanceof HTMLAnchorElement &&
            current !== null &&
            previous.getBoundingClientRect().bottom > current.getBoundingClientRect().top
          );
        }),
      );
      expect(overlap).toBe(false);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBe(0);
    }
  }
});
