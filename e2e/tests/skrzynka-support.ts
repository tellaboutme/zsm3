import type { Page } from "@playwright/test";

const TURNSTILE_STUB =
  "window.turnstile = { getResponse: () => 'stub-token', reset: () => undefined };";
export const QUESTION =
  "Jak mogę umówić się na rozmowę, jeśli nie chcę, żeby klasa o tym wiedziała?";

export async function stubTurnstile(page: Page): Promise<void> {
  await page.route("https://challenges.cloudflare.com/**", async (route) =>
    route.fulfill({
      contentType: "text/javascript",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
      body: TURNSTILE_STUB,
    }),
  );
}

export async function fillQuestion(page: Page, text = QUESTION): Promise<void> {
  await page.getByRole("radio", { name: "Psycholog szkolny" }).check();
  await page.getByLabel("Twoje pytanie").fill(text);
  await page.getByRole("checkbox", { name: /Rozumiem, że pytanie czyta zespół/u }).check();
}
