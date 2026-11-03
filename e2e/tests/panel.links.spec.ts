import { AxeBuilder } from "@axe-core/playwright";

import { expect, test } from "./fixtures.ts";
import { fakeLink, fakeLinksPanel } from "./panel-links-fake.ts";
import { pageProblems } from "./panel-requests-fake.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

function links() {
  return [
    fakeLink(2),
    fakeLink(1, {
      target: null,
      file: { name: "Zadania z fizyki.pdf", format: "pdf", bytes: 2048 },
      passwordProtected: true,
    }),
    fakeLink(0, { revokedAt: "2026-11-02T09:00:00.000Z" }),
  ];
}

test.describe("staff short links", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("lists the author's links with status, destination and clicks", async ({
    page,
    problems,
    browserName,
  }) => {
    await fakeLinksPanel(page, "editor", links());
    await page.goto("/panel/linki");

    const rows = page.locator('[data-panel="link-rows"] > li');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("/s/k7mq4rc");
    await expect(rows.nth(0)).toContainText("Aktywny");
    await expect(rows.nth(1)).toContainText("Plik Zadania z fizyki.pdf (PDF, 2 KB)");
    await expect(rows.nth(1)).toContainText("z hasłem");
    await expect(rows.nth(2)).toContainText("Unieważniony");
    await expect(rows.nth(2).getByRole("button", { name: /Unieważnij/u })).toHaveCount(0);
    await expect(page.locator('[data-panel="link-expiry"]')).toContainText("31 sierpnia");
    await expect(page.locator('[data-panel="status"]')).toHaveText("Na liście: 3 linki.");
    expect(pageProblems(problems, browserName)).toEqual([]);
  });

  test("creates a link to a page and shows the short address to copy", async ({ page }) => {
    const fake = await fakeLinksPanel(page, "editor", links());
    await page.goto("/panel/linki");
    await page
      .getByLabel("Adres strony (zaczyna się od https://)")
      .fill("https://example.org/nowy");
    await page.getByLabel("Hasło (nieobowiązkowe, od 6 znaków)").fill("klasa4tp");
    await page.getByRole("button", { name: "Utwórz link" }).click();

    await expect(page.locator('[data-panel="link-result-title"]')).toBeFocused();
    await expect(page.locator('[data-panel="link-result-url"]')).toHaveValue(/\/s\/nauka23$/u);
    expect(fake.created).toEqual([{ target: "https://example.org/nowy", password: "klasa4tp" }]);
    await expect(page.locator('[data-panel="link-rows"] > li').first()).toContainText("nauka23");
    await expect(page.getByLabel("Hasło (nieobowiązkowe, od 6 znaków)")).toHaveValue("");
  });

  test("uploads a file and refuses a format the server would refuse", async ({ page }) => {
    const fake = await fakeLinksPanel(page, "editor", []);
    await page.goto("/panel/linki");
    await expect(page.locator('[data-panel="status"]')).toContainText("Nie masz jeszcze");
    await page.getByLabel("Do pliku z komputera").check();
    await expect(page.getByLabel("Adres strony (zaczyna się od https://)")).toBeHidden();
    const input = page.getByLabel(/Plik PDF, DOCX/u);
    await input.setInputFiles({
      name: "strona.html",
      mimeType: "text/html",
      buffer: Buffer.from("<p>"),
    });
    await page.getByRole("button", { name: "Utwórz link" }).click();
    await expect(page.locator('[data-panel="link-status"]')).toContainText(
      "Dozwolone są tylko pliki",
    );
    await expect(input).toHaveAttribute("aria-invalid", "true");
    expect(fake.uploads).toEqual([]);

    await input.setInputFiles({
      name: "Karta pracy.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\n%%EOF\n"),
    });
    await page.getByRole("button", { name: "Utwórz link" }).click();
    await expect(page.locator('[data-panel="link-result-url"]')).toHaveValue(/\/s\/nauka23$/u);
    expect(fake.uploads).toHaveLength(1);
    expect(fake.uploads[0]).toContain("multipart/form-data");
    await expect(page.locator('[data-panel="link-rows"] > li')).toContainText(
      "Plik Karta pracy.pdf",
    );
  });

  test("explains a refusal from the server", async ({ page }) => {
    const fake = await fakeLinksPanel(page, "editor", []);
    fake.createStatus = 422;
    await page.goto("/panel/linki");
    await page.getByRole("button", { name: "Utwórz link" }).click();
    await expect(page.locator('[data-panel="link-status"]')).toHaveText(
      "Wpisz adres strony, do której ma prowadzić link.",
    );
    await page.getByLabel("Adres strony (zaczyna się od https://)").fill("http://example.org");
    await page.getByRole("button", { name: "Utwórz link" }).click();
    await expect(page.locator('[data-panel="link-status"]')).toContainText(
      "adres musi zaczynać się od https://",
    );
    await expect(page.locator('[data-panel="link-result"]')).toBeHidden();
  });

  test("revokes a link only after confirmation, from the keyboard", async ({ page }) => {
    const fake = await fakeLinksPanel(page, "editor", links());
    await page.goto("/panel/linki");
    const revoke = page.getByRole("button", { name: /Unieważnij link .*k7mq4rc$/u });
    await revoke.focus();
    await page.keyboard.press("Enter");
    const yes = page.getByRole("button", { name: "Tak, unieważnij link" });
    await expect(yes).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-panel="link-confirm"]')).toBeHidden();
    await expect(revoke).toBeFocused();
    expect(fake.revoked).toEqual([]);

    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-panel="status"]')).toHaveText(
      "Link unieważniony. Przestał działać od razu.",
    );
    expect(fake.revoked).toEqual(["k7mq4rc"]);
    const first = page.locator('[data-panel="link-rows"] > li').first();
    await expect(first).toContainText("Unieważniony");
    await expect(first.getByRole("button", { name: /Kopiuj link/u })).toBeFocused();
  });

  test("shows a server failure while listing", async ({ page }) => {
    const fake = await fakeLinksPanel(page, "editor", links());
    fake.listStatus = 500;
    await page.goto("/panel/linki");
    await expect(page.locator('[data-panel="status"]')).toHaveText(
      "Błąd serwera. Odczekaj chwilę i spróbuj ponownie.",
    );
  });

  test("pages through older links", async ({ page }) => {
    await fakeLinksPanel(page, "editor", links(), 2);
    await page.goto("/panel/linki");
    await expect(page.locator('[data-panel="link-rows"] > li')).toHaveCount(2);
    await page.getByRole("button", { name: "Pokaż starsze" }).click();
    await expect(page.locator('[data-panel="link-rows"] > li')).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Pokaż starsze" })).toBeHidden();
  });

  test("keeps the page closed for a role without content rights", async ({ page }) => {
    await fakeLinksPanel(page, "gallery_editor", links());
    await page.goto("/panel/linki");
    await expect(page.locator('[data-panel="gate"]')).toContainText("Brak uprawnień");
    await expect(page.locator('[data-panel="app"]')).toBeHidden();
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no accessibility violations in ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await fakeLinksPanel(page, "editor", links());
      await page.goto("/panel/linki");
      await page.getByRole("button", { name: /Unieważnij link .*k7mq4rc$/u }).click();
      await expect(page.locator('[data-panel="link-confirm"]')).toBeVisible();

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("fits phone, tablet and desktop widths without sideways scrolling", async ({ page }) => {
    await fakeLinksPanel(page, "editor", links());
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/panel/linki");
      await expect(page.locator('[data-panel="link-rows"] > li')).toHaveCount(3);
      const size = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(size.scroll).toBe(size.client);
    }
  });
});
