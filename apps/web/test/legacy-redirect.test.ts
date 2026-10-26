import { describe, it } from "vitest";

import {
  legacyRedirectTarget,
  resolveLegacyRedirect,
  shouldLookupLegacyRedirect,
} from "../worker/legacy-redirect.ts";

describe("legacy redirect eligibility", () => {
  it("only looks up public read requests after a missing page", ({ expect }) => {
    expect(shouldLookupLegacyRedirect("GET", "/old-page", 404)).toBe(true);
    expect(shouldLookupLegacyRedirect("HEAD", "/old-page", 404)).toBe(true);
    expect(shouldLookupLegacyRedirect("POST", "/old-page", 404)).toBe(false);
    expect(shouldLookupLegacyRedirect("GET", "/old-page", 200)).toBe(false);
    expect(shouldLookupLegacyRedirect("GET", "/old-page", 405)).toBe(false);
  });

  it("does not look up reserved application paths", ({ expect }) => {
    for (const prefix of ["api", "media", "panel", "_astro"]) {
      expect(shouldLookupLegacyRedirect("GET", `/${prefix}`, 404)).toBe(false);
      expect(shouldLookupLegacyRedirect("HEAD", `/${prefix}/missing`, 404)).toBe(false);
      expect(shouldLookupLegacyRedirect("GET", `/${prefix.toUpperCase()}/missing`, 404)).toBe(
        false,
      );
    }
    expect(shouldLookupLegacyRedirect("GET", "/apiculture", 404)).toBe(true);
    for (const path of [
      "/favicon.ico",
      "/robots.txt",
      "/missing.css",
      "/files/photo.webp",
      "/.well-known/security.txt",
      "/missing.js",
      "/missing.jpg",
      "/missing.jpeg",
      "/missing.woff",
      "/missing.woff2",
    ]) {
      expect(shouldLookupLegacyRedirect("GET", path, 404)).toBe(false);
    }
    expect(shouldLookupLegacyRedirect("GET", "/index.php", 404)).toBe(true);
    expect(shouldLookupLegacyRedirect("GET", "/missing.css/child", 404)).toBe(true);
  });
});

describe("legacy redirect target", () => {
  it("accepts only a valid internal path and drops source query parameters", ({ expect }) => {
    expect(legacyRedirectTarget("/old-page", "/szkola/historia")).toBe("/szkola/historia");
    expect(legacyRedirectTarget("/old-page", "/")).toBe("/");
    for (const target of [
      undefined,
      "https://evil.test",
      "//evil.test",
      "/?next=evil",
      "/bad#hash",
      "/bad%0aLocation",
      "/Bad",
      "/bad/",
    ]) {
      expect(legacyRedirectTarget("/old-page", target)).toBeUndefined();
    }
  });

  it("prevents loops after repository path normalisation", ({ expect }) => {
    expect(legacyRedirectTarget("/OLD-PAGE/", "/old-page")).toBeUndefined();
    expect(legacyRedirectTarget("/old-page", "/new-page")).toBe("/new-page");
  });
});

describe("legacy redirect chain", () => {
  it("follows a chain to its final safe target", async ({ expect }) => {
    const rows = new Map([
      ["/old", "/middle"],
      ["/middle", "/kontakt"],
    ]);
    expect(
      await resolveLegacyRedirect(
        "/old",
        (path) => rows.get(path),
        (path) => path === "/kontakt",
      ),
    ).toBe("/kontakt");
  });

  it("rejects cycles, malformed links, and long chains", async ({ expect }) => {
    const cycle = new Map([
      ["/a", "/b"],
      ["/b", "/c"],
      ["/c", "/b"],
    ]);
    expect(
      await resolveLegacyRedirect(
        "/a",
        (path) => cycle.get(path),
        () => false,
      ),
    ).toBeUndefined();
    expect(
      await resolveLegacyRedirect(
        "/a",
        () => "//external.test",
        () => false,
      ),
    ).toBeUndefined();
    let lookups = 0;
    expect(
      await resolveLegacyRedirect(
        "/start",
        () => {
          lookups += 1;
          return `/next-${String(lookups)}`;
        },
        () => false,
      ),
    ).toBeUndefined();
    expect(lookups).toBe(8);
  });

  it("returns a direct target and leaves missing rows alone", async ({ expect }) => {
    expect(
      await resolveLegacyRedirect(
        "/old",
        (path) => (path === "/old" ? "/kontakt" : undefined),
        () => true,
      ),
    ).toBe("/kontakt");
    expect(
      await resolveLegacyRedirect(
        "/missing",
        () => undefined,
        () => true,
      ),
    ).toBeUndefined();
    expect(
      await resolveLegacyRedirect(
        "/old",
        (path) => (path === "/old" ? "/missing" : undefined),
        () => false,
      ),
    ).toBeUndefined();
    for (const target of ["/api/health", "/media/file", "/panel/staff", "/_astro/file"]) {
      expect(
        await resolveLegacyRedirect(
          "/old",
          () => target,
          () => true,
        ),
      ).toBeUndefined();
    }
  });

  it("prefers an existing destination even if a stale redirect row exists for it", async ({
    expect,
  }) => {
    const rows = new Map([
      ["/old", "/kontakt"],
      ["/kontakt", "/missing"],
    ]);
    const lookedUp: string[] = [];
    expect(
      await resolveLegacyRedirect(
        "/old",
        (path) => {
          lookedUp.push(path);
          return rows.get(path);
        },
        (path) => path === "/kontakt",
      ),
    ).toBe("/kontakt");
    expect(lookedUp).toEqual(["/old"]);
  });
});
