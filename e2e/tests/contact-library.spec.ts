import { AxeBuilder } from "@axe-core/playwright";

import { expect, test } from "./fixtures.ts";

test("contact, library and clubs remain accessible on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of ["/kontakt", "/szkola/biblioteka", "/uczniowie/kola-i-kluby"]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(result.violations, path).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBe(0);
  }
});

test("the library and clubs show their real sections as cards", async ({ page }) => {
  for (const [path, heading] of [
    ["/szkola/biblioteka", "Katalog online e-Biblio"],
    ["/uczniowie/kola-i-kluby", "Drużyna e-sportowa"],
  ] as const) {
    await page.goto(path);
    await expect(page.locator(".card-layout .section").filter({ hasText: heading })).toBeVisible();
  }
});

test("the contact map never connects to Google before clicking", async ({ page }) => {
  const googleRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname.includes("google.")) {
      googleRequests.push(request.url());
    }
  });
  await page.goto("/kontakt");
  const map = page.getByRole("link", { name: /Zobacz dojazd w Google Maps/u });
  await expect(map).toHaveAttribute(
    "href",
    "https://www.google.com/maps/place/Technikum+Mechaniczne+Nr+17/@50.0765707,20.048393,989m/data=!3m2!1e3!4b1!4m6!3m5!1s0x4716450cf0a6cd7f:0x8c5ec628100fb271!8m2!3d50.0765707!4d20.0509679!16s%2Fg%2F1tsjcd7r?entry=ttu&g_ep=EgoyMDI2MTAyMC4wIKXMDSoASAFQAw%3D%3D",
  );
  expect(googleRequests).toEqual([]);
});

test("telephone links lose default underlines but honour accessibility settings", async ({
  page,
}) => {
  await page.goto("/kontakt");
  const phone = page.getByRole("link", { name: "12 644 06 89", exact: true });
  await expect(phone).toHaveCSS("text-decoration-line", "none");
  await page.locator("html").evaluate((root) => {
    root.setAttribute("data-underline", "on");
  });
  await expect(phone).toHaveCSS("text-decoration-line", "underline");
});

test("email links open the preview dialog, which validates locally and never sends personal data", async ({
  page,
}) => {
  test.skip(process.env["CONTACT_PRODUCTION"] === "true");
  const sentinel = "PrivateSentinel82413";
  const requests: string[] = [];
  page.on("request", (request) => {
    requests.push(`${request.url()} ${request.postData() ?? ""}`);
  });
  await page.goto("/kontakt");
  const preview = page.getByRole("dialog", { name: "Napisz do szkoły" });
  await expect(preview).not.toBeVisible();
  const email = page.locator('.main a[href^="mailto:"]');
  await email.click();
  await expect(preview).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await expect(preview.locator("[data-preview-recipient]")).toHaveText(
    "s@zespolszkolmechanicznych.edu.pl",
  );
  await expect(preview.getByRole("link", { name: "otwórz program pocztowy" })).toHaveAttribute(
    "href",
    "mailto:s@zespolszkolmechanicznych.edu.pl",
  );
  await expect(preview.getByText(/Wiadomość nie zostanie wysłana/u)).toBeVisible();
  await expect(preview.locator("form")).toHaveCount(0);
  await expect(preview.locator("[name]")).toHaveCount(0);
  await expect(preview.getByRole("button", { name: "Zamknij formularz" })).toBeFocused();
  await preview.getByRole("button", { name: /Sprawdź formularz/u }).click();
  await expect(preview.getByRole("status")).toBeEmpty();
  await preview.getByLabel("Imię i nazwisko").fill(sentinel);
  await preview.getByLabel("Twój adres e-mail").fill(`${sentinel}@example.org`);
  await preview.getByLabel("Temat").fill(sentinel);
  await preview.getByLabel("Wiadomość").fill(sentinel);
  await preview.getByRole("button", { name: /Sprawdź formularz/u }).click();
  await expect(preview.getByRole("status")).toContainText("Nic nie zostało wysłane ani zapisane");
  await expect(page).toHaveURL(/\/kontakt$/u);
  expect(requests.filter((request) => request.includes(sentinel))).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(preview).not.toBeVisible();
  await expect(email).toBeFocused();
  await email.click();
  await expect(preview.getByLabel("Imię i nazwisko")).toBeEmpty();
  await expect(preview.getByRole("status")).toBeEmpty();
  await preview.getByRole("button", { name: "Zamknij formularz" }).click();
  await expect(email).toBeFocused();
});

test("department and footer e-mail links open the preview for their own recipient", async ({
  page,
}) => {
  test.skip(process.env["CONTACT_PRODUCTION"] === "true");
  await page.goto("/kontakt");
  const preview = page.getByRole("dialog", { name: "Napisz do szkoły" });
  const links = page.locator('.cards a[href^="mailto:"], footer a[href^="mailto:"]');
  expect(await links.count()).toBeGreaterThan(1);
  for (const link of await links.all()) {
    const address = await link.getAttribute("href");
    await link.click();
    await expect(preview).toBeVisible();
    await expect(preview.locator("[data-preview-recipient]")).toHaveText(
      address?.slice("mailto:".length) ?? "",
    );
    await expect(preview.locator("[data-preview-mailto]")).toHaveAttribute("href", address ?? "");
    await preview.getByRole("button", { name: "Zamknij formularz" }).click();
    await expect(link).toBeFocused();
  }
});

test("e-mail links throughout the site share one preview dialog", async ({ page }) => {
  test.skip(process.env["CONTACT_PRODUCTION"] === "true");
  for (const [path, selector, recipient] of [
    ["/kontakt", '.main a[href^="mailto:"]', "s@zespolszkolmechanicznych.edu.pl"],
    [
      "/szkola/biblioteka",
      'main a[href="mailto:bibliozsm3@poczta.onet.pl"]',
      "bibliozsm3@poczta.onet.pl",
    ],
    ["/rodzice/rada-rodzicow", 'main a[href="mailto:rodzice.zsm3@wp.pl"]', "rodzice.zsm3@wp.pl"],
    [
      "/polityka-prywatnosci",
      'main a[href="mailto:inspektor4@mjo.krakow.pl"]',
      "inspektor4@mjo.krakow.pl",
    ],
    [
      "/szkola/biblioteka",
      'footer a[href="mailto:s@zespolszkolmechanicznych.edu.pl"]',
      "s@zespolszkolmechanicznych.edu.pl",
    ],
  ] as const) {
    await page.goto(path);
    await expect(page.locator("[data-contact-preview]")).toHaveCount(1);
    const link = page.locator(selector);
    await expect(link).toHaveAttribute("href", `mailto:${recipient}`);
    await link.click();
    const preview = page.getByRole("dialog", { name: "Napisz do szkoły" });
    await expect(preview).toBeVisible();
    await expect(preview.locator("[data-preview-recipient]")).toHaveText(recipient);
    await expect(preview.locator("[data-preview-mailto]")).toHaveAttribute(
      "href",
      `mailto:${recipient}`,
    );
    await page.keyboard.press("Escape");
    await expect(preview).not.toBeVisible();
    await expect(link).toBeFocused();
  }
});

test("the preview traps keyboard focus and closes on its backdrop", async ({ page }) => {
  test.skip(process.env["CONTACT_PRODUCTION"] === "true");
  await page.goto("/szkola/biblioteka");
  const link = page.locator('main a[href="mailto:bibliozsm3@poczta.onet.pl"]');
  await link.focus();
  await page.keyboard.press("Enter");
  const preview = page.getByRole("dialog", { name: "Napisz do szkoły" });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("button", { name: "Zamknij formularz" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(preview.getByRole("link", { name: "otwórz program pocztowy" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(link).toBeFocused();
  await link.click();
  const bounds = await preview.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) {
    return;
  }
  await page.mouse.click(bounds.x + bounds.width / 2, Math.max(0, bounds.y - 4));
  await expect(preview).not.toBeVisible();
  await expect(link).toBeFocused();
});

test("production pages keep mailto links without a dialog", async ({ page }) => {
  test.skip(process.env["CONTACT_PRODUCTION"] !== "true");
  for (const path of [
    "/kontakt",
    "/szkola/biblioteka",
    "/rodzice/rada-rodzicow",
    "/polityka-prywatnosci",
  ]) {
    await page.goto(path);
    await expect(page.locator("[data-contact-preview]")).toHaveCount(0);
    await expect(page.locator('a[href^="mailto:"]').first()).toHaveAttribute("href", /^mailto:/u);
  }
});
