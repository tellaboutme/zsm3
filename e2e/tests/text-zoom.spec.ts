import { expect, test } from "./fixtures.ts";

const TEMPLATES = [
  "/",
  "/aktualnosci",
  "/aktualnosci/2026/tydzien-przeciwdzialania-przemocy-rowiesniczej",
  "/kandydaci/zawody/technik-informatyk",
  "/kandydaci/zawody/technik-elektromobilnosci",
  "/kandydaci/szkola-w-obiektywie",
  "/rodzice/informacje",
  "/rodzice/wywiadowki",
  "/uczniowie/dzwonki",
  "/uczniowie/wzory-dokumentow",
  "/szkola/galeria/2025-2026/przykladowy-album",
] as const;

test("every template fits a phone at 200% text without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of TEMPLATES) {
    await page.goto(path);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBe(0);
  }
});

test("photo placeholders carry no visible stand-in text", async ({ page }) => {
  await page.goto("/aktualnosci");
  await expect(page.getByText("Preview Image")).toHaveCount(0);
});
