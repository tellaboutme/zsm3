import { expect, test } from "./fixtures.ts";

test.use({ javaScriptEnabled: false });

test("typing and pressing Enter cannot transmit personal data", async ({ page }) => {
  test.skip(process.env["CONTACT_PRODUCTION"] === "true");
  const sentinel = "PrivateSentinel82413";
  const requests: string[] = [];
  page.on("request", (request) => {
    requests.push(`${request.url()} ${request.postData() ?? ""}`);
  });
  await page.goto("/kontakt");
  const email = page.locator('.main a[href^="mailto:"]');
  await expect(email).toHaveAttribute("href", "mailto:s@zespolszkolmechanicznych.edu.pl");
  const preview = page.locator("[data-contact-preview]");
  await expect(preview).not.toBeVisible();
  await preview.evaluate((dialog: HTMLDialogElement) => {
    dialog.showModal();
  });
  await preview.getByLabel("Imię i nazwisko").fill(sentinel);
  await preview.getByLabel("Twój adres e-mail").fill(`${sentinel}@example.org`);
  await preview.getByLabel("Temat").fill(sentinel);
  await preview.getByLabel("Wiadomość").fill(sentinel);
  await preview.getByLabel("Wiadomość").press("Enter");
  await preview.getByRole("button", { name: /Sprawdź formularz/u }).click();
  await expect(page).toHaveURL(/\/kontakt$/u);
  expect(requests.filter((request) => request.includes(sentinel))).toEqual([]);
});

test("library and privacy e-mail links remain native without JavaScript", async ({ page }) => {
  test.skip(process.env["CONTACT_PRODUCTION"] === "true");
  for (const [path, address] of [
    ["/szkola/biblioteka", "bibliozsm3@poczta.onet.pl"],
    ["/polityka-prywatnosci", "inspektor4@mjo.krakow.pl"],
  ] as const) {
    await page.goto(path);
    await expect(page.locator(`main a[href="mailto:${address}"]`)).toHaveAttribute(
      "href",
      `mailto:${address}`,
    );
    await expect(page.locator("[data-contact-preview]")).not.toBeVisible();
  }
});
