import { requestStatuses, type RequestStatus } from "@zsm3/contracts/requests";
import { describe, it } from "vitest";

import {
  assertTransition,
  canTransition,
  InvalidTransitionError,
  isOpen,
} from "../../src/domain/request-lifecycle.ts";

const TRANSITIONS: readonly (readonly [RequestStatus, RequestStatus, boolean])[] = [
  ["submitted", "in_progress", true],
  ["submitted", "rejected", true],
  ["submitted", "withdrawn", true],
  ["submitted", "ready", false],
  ["submitted", "collected", false],
  ["submitted", "submitted", false],
  ["in_progress", "ready", true],
  ["in_progress", "rejected", true],
  ["in_progress", "withdrawn", true],
  ["in_progress", "submitted", false],
  ["in_progress", "collected", false],
  ["in_progress", "in_progress", false],
  ["ready", "collected", true],
  ["ready", "rejected", true],
  ["ready", "withdrawn", true],
  ["ready", "submitted", false],
  ["ready", "in_progress", false],
  ["ready", "ready", false],
  ["collected", "withdrawn", false],
  ["collected", "rejected", false],
  ["collected", "submitted", false],
  ["collected", "in_progress", false],
  ["collected", "ready", false],
  ["collected", "collected", false],
  ["rejected", "withdrawn", false],
  ["rejected", "collected", false],
  ["rejected", "submitted", false],
  ["rejected", "in_progress", false],
  ["rejected", "ready", false],
  ["rejected", "rejected", false],
  ["withdrawn", "rejected", false],
  ["withdrawn", "collected", false],
  ["withdrawn", "submitted", false],
  ["withdrawn", "in_progress", false],
  ["withdrawn", "ready", false],
  ["withdrawn", "withdrawn", false],
];

describe("canTransition", () => {
  it("covers every status pair exactly once", ({ expect }) => {
    expect(TRANSITIONS).toHaveLength(requestStatuses.length ** 2);
    expect(new Set(TRANSITIONS.map(([from, to]) => `${from}>${to}`)).size).toBe(
      requestStatuses.length ** 2,
    );
  });

  for (const [from, to, allowed] of TRANSITIONS) {
    it(`${from} -> ${to} is ${allowed ? "allowed" : "forbidden"}`, ({ expect }) => {
      expect(canTransition(from, to)).toBe(allowed);
    });
  }
});

describe("isOpen", () => {
  it("treats submitted, in_progress and ready as open", ({ expect }) => {
    expect(isOpen("submitted")).toBe(true);
    expect(isOpen("in_progress")).toBe(true);
    expect(isOpen("ready")).toBe(true);
    expect(isOpen("collected")).toBe(false);
    expect(isOpen("rejected")).toBe(false);
    expect(isOpen("withdrawn")).toBe(false);
  });
});

describe("assertTransition", () => {
  it("passes for allowed transitions", ({ expect }) => {
    expect(() => {
      assertTransition("submitted", "in_progress");
    }).not.toThrow();
  });

  it("throws a named error for forbidden transitions", ({ expect }) => {
    try {
      assertTransition("collected", "withdrawn");
      expect.unreachable("assertTransition should have thrown");
    } catch (error) {
      if (!(error instanceof InvalidTransitionError)) {
        expect.unreachable("expected InvalidTransitionError");
      } else {
        expect(error.name).toBe("InvalidTransitionError");
        expect(error.from).toBe("collected");
        expect(error.to).toBe("withdrawn");
        expect(error.message).toContain("collected");
        expect(error.message).toContain("withdrawn");
      }
    }
  });
});
