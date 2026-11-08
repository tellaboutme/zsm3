import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";
import {
  type Box,
  type Geometry,
  geometry,
  openPhoto,
  scrollStage,
} from "./gallery-zoom-support.ts";

const PHOTOS = [
  { name: "landscape", width: 1600, height: 1067 },
  { name: "portrait", width: 1200, height: 1600 },
  { name: "tall", width: 600, height: 1600 },
  { name: "square", width: 1600, height: 1600 },
] as const;
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
] as const;
const TOLERANCE = 1.5;

function expectCentredOrCovering(g: Geometry, label: string): void {
  const axes = [
    [g.image.left - g.stage.left, g.image.width, g.limit.left, g.stage.width, "x"],
    [g.image.top - g.stage.top, g.image.height, g.limit.top, g.stage.height, "y"],
  ] as const;
  for (const [offset, size, limit, room, axis] of axes) {
    if (limit <= 0) {
      expect(Math.abs(offset - (room - size) / 2), `${label} centred on ${axis}`).toBeLessThan(
        TOLERANCE,
      );
    } else {
      expect(size, `${label} covers ${axis}`).toBeGreaterThan(room - TOLERANCE * 2);
    }
  }
}

function expectZoomBounds(zoomed: Geometry, fit: Box, label: string): void {
  const { natural } = zoomed;
  expect(zoomed.image.width, `${label} not above natural`).toBeLessThanOrEqual(natural.width + 1);
  expect(zoomed.image.width, `${label} at most twice the fit`).toBeLessThanOrEqual(
    fit.width * 2 + 1,
  );
  expect(zoomed.image.width, `${label} visibly larger`).toBeGreaterThanOrEqual(fit.width * 1.1 - 1);
  const ratio = natural.width / natural.height;
  expect(Math.abs(zoomed.image.width / zoomed.image.height - ratio), label).toBeLessThan(0.01);
}

async function expectEdgesReachable(page: Page, label: string): Promise<void> {
  await scrollStage(page, 0, 0);
  const start = await geometry(page);
  await scrollStage(page, 1e6, 1e6);
  const end = await geometry(page);
  if (start.limit.left > 0) {
    expect(Math.abs(start.image.left - start.stage.left), `${label} left edge`).toBeLessThan(
      TOLERANCE,
    );
    expect(
      Math.abs(end.image.left + end.image.width - (end.stage.left + end.stage.width)),
      `${label} right edge`,
    ).toBeLessThan(TOLERANCE);
  }
  if (start.limit.top > 0) {
    expect(Math.abs(start.image.top - start.stage.top), `${label} top edge`).toBeLessThan(
      TOLERANCE,
    );
    expect(
      Math.abs(end.image.top + end.image.height - (end.stage.top + end.stage.height)),
      `${label} bottom edge`,
    ).toBeLessThan(TOLERANCE);
  }
}

for (const viewport of VIEWPORTS) {
  for (const photo of PHOTOS) {
    const size = `${String(viewport.width)}x${String(viewport.height)}`;
    test(`a ${photo.name} photo zooms centred, bounded and pannable at ${size}`, async ({
      page,
      problems,
    }) => {
      await page.setViewportSize(viewport);
      await openPhoto(page, photo.width, photo.height);
      const fit = await geometry(page);
      expectCentredOrCovering(fit, `${photo.name} fit`);
      await page.getByRole("button", { name: "Powiększ" }).click();
      const zoomed = await geometry(page);
      expect(zoomed.zoomed).toBe(true);
      expectZoomBounds(zoomed, fit.image, photo.name);
      expectCentredOrCovering(zoomed, `${photo.name} zoomed`);
      await expectEdgesReachable(page, photo.name);
      await page.getByRole("button", { name: "Pomniejsz" }).click();
      const reset = await geometry(page);
      expect(reset.zoomed).toBe(false);
      expect(Math.abs(reset.image.width - fit.image.width)).toBeLessThan(1);
      expect(Math.abs(reset.image.left - fit.image.left)).toBeLessThan(1);
      expect(problems).toEqual([]);
    });
  }
}
