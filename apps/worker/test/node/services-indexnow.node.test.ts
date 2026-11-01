import { INDEXNOW_ENDPOINT, INDEXNOW_KEY, indexNowKeyLocation } from "@zsm3/contracts/indexnow";
import { describe, it, vi } from "vitest";
import { z } from "zod";

import { indexNowSender } from "../../src/services/indexnow.ts";

const HOST = "search.zsm3.test";
const URLS = ["/aktualnosci/2026/salon-maturzystow", "/kontakt"];

function doFetchReply(status: number) {
  return vi.fn(async (...args: Parameters<typeof fetch>) => {
    if (args.length !== 2) throw new Error("Missing fetch options");
    return Promise.resolve(new Response(null, { status }));
  });
}

describe("indexNowSender", () => {
  it("posts a json payload with the host, the key and the urls", async ({ expect }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const doFetch = doFetchReply(200);
    const sender = indexNowSender(doFetch, HOST);

    await expect(sender.submit(URLS)).resolves.toBe(true);
    expect(logged).not.toHaveBeenCalled();
    logged.mockRestore();
    expect(doFetch).toHaveBeenCalledExactlyOnceWith(
      INDEXNOW_ENDPOINT,
      expect.objectContaining({ method: "POST" }),
    );
    const init = doFetch.mock.calls[0]?.[1];
    expect(init?.headers).toEqual({ "content-type": "application/json" });
    const payload = z.unknown().parse(JSON.parse(z.string().parse(init?.body)));
    expect(payload).toEqual({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: indexNowKeyLocation(HOST),
      urlList: URLS,
    });
  });

  it("reports and logs a rejection when the endpoint answers with an error status", async ({
    expect,
  }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sender = indexNowSender(doFetchReply(429), HOST);

    await expect(sender.submit(URLS)).resolves.toBe(false);
    expect(logged).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ event: "indexnow_unavailable", errorName: "HttpStatus", status: 429 }),
    );
    logged.mockRestore();
  });

  it("treats a network failure as a rejection and logs it", async ({ expect }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const doFetch = vi.fn(async () => Promise.reject(new TypeError("network down")));
    const sender = indexNowSender(doFetch, HOST);

    await expect(sender.submit(URLS)).resolves.toBe(false);
    expect(logged).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ event: "indexnow_unavailable", errorName: "TypeError" }),
    );
    logged.mockRestore();
  });

  it("logs an unknown failure when fetch throws a non-error", async ({ expect }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sender = indexNowSender(vi.fn<typeof fetch>().mockRejectedValue("unavailable"), HOST);

    await expect(sender.submit(URLS)).resolves.toBe(false);
    expect(logged).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ event: "indexnow_unavailable", errorName: "unknown" }),
    );
    logged.mockRestore();
  });
});
