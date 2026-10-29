import { AxeBuilder } from "@axe-core/playwright";

import { expect, test } from "./fixtures.ts";

test("the gallery shows an honest empty state without albums or photos", async ({
  page,
  problems,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const response = await page.goto("/szkola/galeria");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Galeria" })).toBeVisible();
  const emptyState = page.getByRole("region", { name: "Brak zdjęć w galerii" });
  await expect(emptyState).toContainText(
    "W galerii nie ma obecnie opublikowanych albumów ani zdjęć.",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Galeria Zespołu Szkół Mechanicznych nr 3 w Krakowie. Obecnie nie ma w niej opublikowanych zdjęć.",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  await expect(page.locator("main")).not.toContainText(
    /Pracownie mechatroniczne|Warsztaty samochodowe|Pracownie lotnicze|Pracownie informatyczne|Erasmus\+|Dzień Patrona/u,
  );
  await expect(page.locator("main section")).toHaveCount(1);
  await expect(
    page.locator("main h3, main ul, main article, main figure, main picture, main img"),
  ).toHaveCount(0);
  await expect(page.locator('main a[href^="/szkola/galeria/"]')).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  expect(problems).toEqual([]);
});
