import { describe, it } from "vitest";

import { expectedApiHeaders } from "./expected-api-headers.ts";
import { send } from "./support.ts";

describe("API security headers", () => {
  it.for(["/api/health", "/api/unknown"])("are set on %s", async (path, { expect }) => {
    const response = await send(path);

    for (const [name, value] of Object.entries(expectedApiHeaders)) {
      expect(response.headers.get(name), name).toBe(value);
    }
  });
});
