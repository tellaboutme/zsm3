export const INDEXNOW_KEY = "9d4f13e82c07ab65b0413f2aa7c8de19";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export const INDEXNOW_TIMEOUT_MS = 5_000;

export const DEFAULT_PUBLIC_ORIGIN = "https://www.zespolszkolmechanicznych.edu.pl";

export function indexNowKeyLocation(host: string): string {
  return `https://${host}/${INDEXNOW_KEY}.txt`;
}
