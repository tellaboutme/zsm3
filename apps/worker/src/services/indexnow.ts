import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_TIMEOUT_MS,
  indexNowKeyLocation,
} from "@zsm3/contracts/indexnow";

import { logEvent } from "../logging/log.ts";

export interface IndexNowEndpoint {
  submit(urlList: readonly string[]): Promise<boolean>;
}

export function indexNowSender(fetcher: typeof fetch, host: string): IndexNowEndpoint {
  return {
    async submit(urlList) {
      try {
        const response = await fetcher(INDEXNOW_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            host,
            key: INDEXNOW_KEY,
            keyLocation: indexNowKeyLocation(host),
            urlList,
          }),
          signal: AbortSignal.timeout(INDEXNOW_TIMEOUT_MS),
        });
        return response.ok;
      } catch (error) {
        logEvent({
          event: "indexnow_unavailable",
          errorName: error instanceof Error ? error.name : "unknown",
        });
        return false;
      }
    },
  };
}
