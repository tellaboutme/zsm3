import { expect, test } from "@playwright/test";

const FIXED_NOW = new Date("2026-10-22T08:00:00Z");
const WIDTHS = [360, 768, 1280, 1920] as const;
const HEIGHT = 900;

const templates = [
  { name: "home", path: "/" },
  { name: "hub", path: "/uczniowie" },
  { name: "professions", path: "/kandydaci/zawody" },
  { name: "programme", path: "/kandydaci/zawody/technik-programista" },
  { name: "news", path: "/aktualnosci" },
  { name: "article", path: "/aktualnosci/2026/dzien-patrona-szkoly-i-slubowanie-klas-pierwszych" },
  { name: "library", path: "/szkola/biblioteka" },
  { name: "content", path: "/szkola/historia" },
  { name: "bells", path: "/uczniowie/dzwonki" },
  { name: "clubs", path: "/uczniowie/kola-i-kluby" },
  { name: "calendar", path: "/szkola/terminarz" },
  { name: "meetings", path: "/rodzice/wywiadowki" },
  { name: "contact", path: "/kontakt" },
  { name: "documents", path: "/uczniowie/wzory-dokumentow" },
  { name: "staff", path: "/szkola/kadra" },
  { name: "search", path: "/szukaj?q=lotnictwo" },
  { name: "sitemap", path: "/mapa-strony" },
  { name: "privacy", path: "/polityka-prywatnosci" },
  { name: "not-found", path: "/nie-istnieje" },
] as const;

test.skip(process.platform !== "linux", "Baselines are rendered on Linux in CI.");

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of WIDTHS) {
    test.describe(`${colorScheme} ${String(width)}`, () => {
      test.use({ viewport: { width, height: HEIGHT }, colorScheme, reducedMotion: "reduce" });

      for (const template of templates) {
        test(template.name, async ({ page }) => {
          await page.clock.setFixedTime(FIXED_NOW);
          await page.goto(template.path);
          await page.waitForLoadState("networkidle");
          await page.evaluate(async () => document.fonts.ready);
          await page.locator("[data-banner]").evaluateAll((banners) => {
            for (const banner of banners) {
              banner.remove();
            }
          });

          await expect(page).toHaveScreenshot(
            `${template.name}-${colorScheme}-${String(width)}.png`,
            {
              fullPage: true,
              animations: "disabled",
              caret: "hide",
              mask: [page.locator("[data-live-status], [data-dated]")],
            },
          );
        });
      }
    });
  }
}
