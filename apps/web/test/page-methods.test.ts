import { describe, it } from "vitest";

import { isReadMethod, isSitePage, methodNotAllowed } from "../src/lib/page-methods.ts";

describe("page methods", () => {
  it("allows only reading pages", ({ expect }) => {
    expect(isReadMethod("GET")).toBe(true);
    expect(isReadMethod("HEAD")).toBe(true);
    expect(isReadMethod("POST")).toBe(false);
    expect(isReadMethod("get")).toBe(false);
  });

  it("answers other methods with 405 and the allowed list", async ({ expect }) => {
    const response = methodNotAllowed();

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
    expect(await response.text()).toBe("");
  });

  it("loads the site frame state only for site pages", ({ expect }) => {
    expect(isSitePage("/")).toBe(true);
    expect(isSitePage("/aktualnosci/2026/salon")).toBe(true);
    expect(isSitePage("/panel")).toBe(false);
    expect(isSitePage("/panel/aktualnosci")).toBe(false);
    expect(isSitePage("/panelowy")).toBe(true);
    expect(isSitePage("/szukaj/indeks.json")).toBe(false);
    expect(isSitePage("/szkola/terminarz.ics")).toBe(false);
  });
});
