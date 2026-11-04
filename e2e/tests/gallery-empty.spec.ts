import { AxeBuilder } from "@axe-core/playwright";

import { expect, test } from "./fixtures.ts";

test("a school year without albums shows an honest empty state", async ({ page, problems }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const response = await page.goto("/szkola/galeria/2019-2020");

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "Rok szkolny 2019/2020" }),
  ).toBeVisible();
  const emptyState = page.getByRole("region", { name: "Brak opublikowanych albumów" });
  await expect(emptyState).toContainText("W tym roku szkolnym nie ma jeszcze żadnych albumów.");
  await expect(emptyState.getByRole("link", { name: "Zobacz inne lata" })).toHaveAttribute(
    "href",
    "/szkola/galeria",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  await expect(page.locator("main img")).toHaveCount(0);
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
