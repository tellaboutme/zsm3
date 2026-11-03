import { AxeBuilder } from "@axe-core/playwright";

import { expect, test } from "./fixtures.ts";
import { fakeLink, fakeLinksPanel, type FakeAdminLink } from "./panel-links-fake.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

function adminLinks(): FakeAdminLink[] {
  return [
    {
      code: "k7mq4rx",
      owner: "byly-nauczyciel@zsm3.local",
      kind: "file",
      createdAt: "2026-10-01T08:00:00.000Z",
      expiresAt: "2027-08-31T22:00:00.000Z",
      passwordProtected: true,
    },
    {
      code: "k7mq4ry",
      owner: "nauczyciel@zsm3.local",
      kind: "url",
      createdAt: "2026-09-15T08:00:00.000Z",
      expiresAt: "2027-08-31T22:00:00.000Z",
      passwordProtected: false,
    },
  ];
}

test.describe("administrator short links", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("an admin revokes a departed teacher's link after confirming", async ({ page }) => {
    const fake = await fakeLinksPanel(page, "admin", [fakeLink(0)], { adminLinks: adminLinks() });
    await page.goto("/panel/linki");

    const section = page.getByRole("region", { name: "Aktywne linki wszystkich pracowników" });
    const rows = section.locator('[data-panel="admin-rows"] > li');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("autor byly-nauczyciel@zsm3.local · plik");
    await expect(rows.nth(0)).toContainText("z hasłem");
    await expect(section).not.toContainText("example.org");

    await rows
      .nth(0)
      .getByRole("button", { name: /Unieważnij link .*k7mq4rx/u })
      .focus();
    await page.keyboard.press("Enter");
    const confirm = section.locator('[data-panel="admin-confirm"]');
    await expect(confirm).toContainText("należący do byly-nauczyciel@zsm3.local");
    await expect(section.getByRole("button", { name: "Tak, unieważnij link" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(confirm).toBeHidden();
    expect(fake.adminRevoked).toEqual([]);

    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(rows).toHaveCount(1);
    await expect(section.locator('[data-panel="admin-status"]')).toHaveText(
      "Link unieważniony. Przestał działać od razu, a w dzienniku zapisano, kto to zrobił.",
    );
    expect(fake.adminRevoked).toEqual(["k7mq4rx"]);
    await expect(rows.nth(0).getByRole("button")).toBeFocused();
  });

  test("staff without the admin role never see or request every link", async ({ page }) => {
    const fake = await fakeLinksPanel(page, "editor", [fakeLink(0)], { adminLinks: adminLinks() });
    await page.goto("/panel/linki");

    await expect(page.locator('[data-panel="link-rows"] > li')).toHaveCount(1);
    await expect(page.locator('[data-panel="admin-links"]')).toBeHidden();
    expect(fake.adminRequests).toEqual([]);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`the admin list has no accessibility violations in ${colorScheme} theme`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await fakeLinksPanel(page, "admin", [fakeLink(0)], { adminLinks: adminLinks() });
      await page.goto("/panel/linki");
      const section = page.locator('[data-panel="admin-links"]');
      await expect(section.locator('[data-panel="admin-rows"] > li')).toHaveCount(2);
      await section.getByRole("button", { name: /Unieważnij link .*k7mq4rx/u }).click();
      await expect(section.locator('[data-panel="admin-confirm"]')).toBeVisible();

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
