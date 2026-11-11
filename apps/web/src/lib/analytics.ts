export const BEACON_SCRIPT_URL = "https://static.cloudflareinsights.com/beacon.min.js";
export const BEACON_SCRIPT_ORIGIN = "https://static.cloudflareinsights.com";
export const BEACON_REPORT_ORIGIN = "https://cloudflareinsights.com";

const BEACON_TOKEN = /^[0-9a-f]{32}$/;

export function beaconSettings(token: string | undefined): string | undefined {
  const value = token?.trim();
  if (value === undefined || !BEACON_TOKEN.test(value)) {
    return undefined;
  }
  return JSON.stringify({ token: value, spa: false });
}
