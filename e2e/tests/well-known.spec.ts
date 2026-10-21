import { expect, test } from "./fixtures.ts";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

test.describe("well-known files", () => {
  test("security.txt is valid and not about to expire", async ({ request }) => {
    const response = await request.get("/.well-known/security.txt");
    const fields = new Map(
      (await response.text())
        .trim()
        .split("\n")
        .map((line) => {
          const separator = line.indexOf(": ");
          return [line.slice(0, separator), line.slice(separator + 2)] as const;
        }),
    );

    expect(response.status()).toBe(200);
    expect(fields.get("Contact")).toMatch(/^https:\/\//u);
    const expires = Date.parse(fields.get("Expires") ?? "");
    expect(expires - Date.now()).toBeGreaterThan(THIRTY_DAYS_MS);
  });

  test("robots.txt keeps the unfinished site out of search engines", async ({ request }) => {
    const response = await request.get("/robots.txt");

    expect(await response.text()).toBe("User-agent: *\nDisallow: /\n");
  });
});
