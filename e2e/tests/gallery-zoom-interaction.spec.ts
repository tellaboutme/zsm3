import { expect, test } from "./fixtures.ts";
import { geometry, openPhoto } from "./gallery-zoom-support.ts";

test("a photo already at its natural size offers no zoom", async ({ page, problems }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPhoto(page, 480, 320);
  const zoom = page.getByRole("button", { name: "Powiększ" });
  await expect(zoom).toBeDisabled();
  await expect(zoom).toHaveAttribute("aria-pressed", "false");
  const before = await geometry(page);
  await page.locator("[data-lightbox-image]").click();
  const after = await geometry(page);
  expect(after.zoomed).toBe(false);
  expect(after.image).toEqual(before.image);
  expect(problems).toEqual([]);
});

test("a small photo on a phone zooms only up to its natural size", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPhoto(page, 480, 320);
  await page.getByRole("button", { name: "Powiększ" }).click();
  const zoomed = await geometry(page);
  expect(zoomed.zoomed).toBe(true);
  expect(Math.round(zoomed.image.width)).toBe(480);
  expect(Math.round(zoomed.image.height)).toBe(320);
});

test("clicking the photo zooms around the clicked point", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPhoto(page, 1600, 1067);
  const fit = await geometry(page);
  const x = fit.image.left + fit.image.width * 0.3;
  const y = fit.image.top + fit.image.height * 0.6;
  await page.mouse.click(x, y);
  const zoomed = await geometry(page);
  expect(zoomed.zoomed).toBe(true);
  expect(Math.abs((x - zoomed.image.left) / zoomed.image.width - 0.3)).toBeLessThan(0.01);
  expect(Math.abs((y - zoomed.image.top) / zoomed.image.height - 0.6)).toBeLessThan(0.01);
  await page.getByRole("button", { name: "Pomniejsz" }).click();
  const edgeX = fit.image.left + 3;
  const edgeY = fit.image.top + fit.image.height * 0.5;
  await page.mouse.click(edgeX, edgeY);
  const edge = await geometry(page);
  expect(edge.scroll.left).toBe(0);
  expect(Math.abs((edgeY - edge.image.top) / edge.image.height - 0.5)).toBeLessThan(0.01);
});

test("a drag released outside the stage pans without toggling zoom", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPhoto(page, 1600, 1067);
  await page.getByRole("button", { name: "Powiększ" }).click();
  const before = await geometry(page);
  const cx = before.stage.left + before.stage.width / 2;
  const cy = before.stage.top + before.stage.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 200, cy + 150, { steps: 6 });
  await page.mouse.move(cx + 200, 5, { steps: 6 });
  await page.mouse.up();
  const after = await geometry(page);
  expect(after.zoomed).toBe(true);
  expect(after.scroll.left).toBeLessThan(before.scroll.left);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.up();
  expect((await geometry(page)).zoomed).toBe(false);
});

test("rotating a phone while zoomed keeps valid geometry", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPhoto(page, 1200, 1600);
  await page.getByRole("button", { name: "Powiększ" }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect
    .poll(async () => {
      const g = await geometry(page);
      return g.image.width <= g.natural.width + 1 && g.scroll.left <= g.limit.left;
    })
    .toBe(true);
  const rotated = await geometry(page);
  expect(Math.abs(rotated.image.width / rotated.image.height - 0.75)).toBeLessThan(0.01);
  if (rotated.limit.left <= 0) {
    const room = rotated.stage.width - rotated.image.width;
    expect(Math.abs(rotated.image.left - rotated.stage.left - room / 2)).toBeLessThan(1.5);
  }
  await page.getByRole("button", { name: "Pomniejsz" }).click();
  const fit = await geometry(page);
  expect(fit.image.height).toBeLessThanOrEqual(fit.stage.height + 1);
});

test("moving to another photo resets zoom to the fitted view", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPhoto(page, 1600, 1067);
  await page.getByRole("button", { name: "Powiększ" }).click();
  await page.getByRole("button", { name: "Następne" }).click();
  await expect(page.locator("[data-lightbox-position]")).toHaveText("Zdjęcie 2 z 5");
  const next = await geometry(page);
  expect(next.zoomed).toBe(false);
  expect(next.scroll).toEqual({ left: 0, top: 0 });
  await expect(page.getByRole("button", { name: "Powiększ" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("browsing from the zoom button keeps focus inside the dialog", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPhoto(page, 1600, 1067);
  await page.getByRole("button", { name: "Powiększ" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-lightbox-position]")).toHaveText("Zdjęcie 2 z 5");
  const inside = await page.evaluate(
    () =>
      document.querySelector("dialog[data-lightbox]")?.contains(document.activeElement) ?? false,
  );
  expect(inside).toBe(true);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-lightbox-position]")).toHaveText("Zdjęcie 3 z 5");
});

test("an aborted drag does not keep panning on hover", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPhoto(page, 1600, 1067);
  await page.getByRole("button", { name: "Powiększ" }).click();
  const before = await geometry(page);
  const x = before.stage.left + before.stage.width / 2;
  const y = before.stage.top + 3;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 2);
  await page.mouse.move(x, before.stage.top - 30);
  await page.mouse.up();
  await page.mouse.move(x + 300, y + 100, { steps: 8 });
  const after = await geometry(page);
  expect(after.scroll).toEqual(before.scroll);
  expect(after.zoomed).toBe(true);
});
