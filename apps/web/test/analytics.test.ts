import { describe, it } from "vitest";

import { privacyPolicy, privacyPolicyFor } from "../src/data/legal/privacy.ts";
import {
  BEACON_REPORT_ORIGIN,
  BEACON_SCRIPT_ORIGIN,
  BEACON_SCRIPT_URL,
  beaconSettings,
} from "../src/lib/analytics.ts";

const TOKEN = "0123456789abcdef0123456789abcdef";

describe("Cloudflare Web Analytics", () => {
  it("loads the beacon from the Cloudflare origins the CSP allows", ({ expect }) => {
    expect(BEACON_SCRIPT_URL).toBe("https://static.cloudflareinsights.com/beacon.min.js");
    expect(new URL(BEACON_SCRIPT_URL).origin).toBe(BEACON_SCRIPT_ORIGIN);
    expect(BEACON_REPORT_ORIGIN).toBe("https://cloudflareinsights.com");
  });

  it("builds the beacon settings from a site token", ({ expect }) => {
    expect(beaconSettings(TOKEN)).toBe(`{"token":"${TOKEN}","spa":false}`);
    expect(beaconSettings(` ${TOKEN}\n`)).toBe(`{"token":"${TOKEN}","spa":false}`);
  });

  it("stays off without a well-formed token", ({ expect }) => {
    expect(beaconSettings(undefined)).toBeUndefined();
    expect(beaconSettings("")).toBeUndefined();
    expect(beaconSettings(TOKEN.toUpperCase())).toBeUndefined();
    expect(beaconSettings(`${TOKEN}0`)).toBeUndefined();
    expect(beaconSettings(`"${TOKEN.slice(2)}"`)).toBeUndefined();
  });
});

describe("privacy policy and analytics", () => {
  const browsing = (analytics: boolean): string =>
    JSON.stringify(
      privacyPolicyFor(analytics).sections.find((section) => section.id === "przegladanie"),
    );

  it("says there is no analytics while it is off", ({ expect }) => {
    expect(privacyPolicyFor(false)).toBe(privacyPolicy);
    expect(browsing(false)).toContain("nie używa plików cookie, narzędzi analitycznych");
    expect(browsing(false)).not.toContain("Cloudflare Web Analytics");
  });

  it("describes Cloudflare Web Analytics while it is on", ({ expect }) => {
    expect(browsing(true)).toContain("Liczbę odwiedzin mierzy Cloudflare Web Analytics");
    expect(browsing(true)).not.toContain("narzędzi analitycznych");
    expect(privacyPolicyFor(true).version).toBe(privacyPolicy.version);
  });
});
