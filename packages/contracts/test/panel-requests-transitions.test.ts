import { describe, expect, it } from "vitest";

import { requestNextStatuses, staffNextStatuses } from "../src/panel-requests.ts";

describe("request transitions", () => {
  it("lists every next status of the lifecycle", () => {
    expect(requestNextStatuses).toEqual({
      submitted: ["in_progress", "rejected", "withdrawn"],
      in_progress: ["ready", "rejected", "withdrawn"],
      ready: ["collected", "rejected", "withdrawn"],
      collected: [],
      rejected: [],
      withdrawn: [],
    });
  });

  it("leaves withdrawal to the applicant", () => {
    expect(staffNextStatuses("submitted")).toEqual(["in_progress", "rejected"]);
    expect(staffNextStatuses("in_progress")).toEqual(["ready", "rejected"]);
    expect(staffNextStatuses("ready")).toEqual(["collected", "rejected"]);
    expect(staffNextStatuses("collected")).toEqual([]);
    expect(staffNextStatuses("rejected")).toEqual([]);
    expect(staffNextStatuses("withdrawn")).toEqual([]);
  });
});
