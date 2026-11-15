import type { Locator, Page } from "@playwright/test";

export async function panelSections(page: Page): Promise<Locator> {
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  if (await menu.isVisible()) {
    await menu.click();
  }
  return page.getByRole("navigation", { name: "Sekcje panelu" });
}
