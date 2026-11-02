import { describe, it } from "vitest";

import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  indexNowHostSchema,
  indexNowKeyLocation,
} from "../src/indexnow.ts";

describe("INDEXNOW_ENDPOINT", () => {
  it("is the shared IndexNow API that forwards to every participating engine", ({ expect }) => {
    expect(INDEXNOW_ENDPOINT).toBe("https://api.indexnow.org/indexnow");
  });
});

describe("INDEXNOW_KEY", () => {
  it("is the 32 hex characters required by search engines", ({ expect }) => {
    expect(INDEXNOW_KEY).toMatch(/^[0-9a-f]{32}$/u);
  });
});

describe("indexNowKeyLocation", () => {
  it("serves the key file at the public root", ({ expect }) => {
    expect(indexNowKeyLocation("www.zsm3.test")).toBe(`https://www.zsm3.test/${INDEXNOW_KEY}.txt`);
  });
});

const BARE_HOSTS = ["www.zespolszkolmechanicznych.edu.pl", "search.zsm3.test", "zsm3-preview.pl"];

const MALFORMED_HOSTS = [
  "https://www.zsm3.pl",
  "www.zsm3.pl/aktualnosci",
  "www.zsm3.pl:8443",
  "zsm3 .pl",
  "WWW.ZSM3.PL",
  "localhost",
  "zsm3.p",
  "zsm3.pl.",
  `zsm3.${"p".repeat(64)}`,
  "",
];

describe("indexNowHostSchema", () => {
  it("accepts a bare host name", ({ expect }) => {
    for (const host of BARE_HOSTS) {
      expect(indexNowHostSchema.safeParse(host).success, host).toBe(true);
    }
  });

  it("refuses a scheme, path, port, space, capitals, a single label or a malformed suffix", ({
    expect,
  }) => {
    for (const host of MALFORMED_HOSTS) {
      expect(indexNowHostSchema.safeParse(host).success, host).toBe(false);
    }
  });
});
