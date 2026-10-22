import { runInNewContext } from "node:vm";

import fc from "fast-check";
import { Window } from "happy-dom";
import { describe, it } from "vitest";

import {
  bootScript,
  isAllowed,
  parsePreferences,
  PREFERENCES_KEY,
  preferenceNames,
  preferenceOptions,
  readPreferences,
  rootAttributes,
  withPreference,
} from "../src/lib/preferences.ts";

function boot(stored: string | null): Map<string, string | null> {
  const window = new Window();
  if (stored !== null) {
    window.localStorage.setItem(PREFERENCES_KEY, stored);
  }
  runInNewContext(bootScript, { document: window.document, localStorage: window.localStorage });
  const root = window.document.documentElement;
  return new Map(preferenceNames.map((name) => [name, root.getAttribute(`data-${name}`)]));
}

describe("preference model", () => {
  it("keeps the storage key stable so saved settings survive releases", ({ expect }) => {
    expect(PREFERENCES_KEY).toBe("zsm3.preferences");
  });

  it("lists every preference exactly once", ({ expect }) => {
    expect([...preferenceNames].sort()).toEqual(Object.keys(preferenceOptions).sort());
  });

  it("accepts only listed values", ({ expect }) => {
    expect(isAllowed("text", "150")).toBe(true);
    expect(isAllowed("text", "200")).toBe(false);
    expect(isAllowed("theme", 1)).toBe(false);
  });

  it("keeps valid entries and drops everything else", ({ expect }) => {
    const parsed = parsePreferences({
      text: "125",
      theme: "neon",
      contrast: "high",
      motion: ["reduce"],
      unknown: "on",
    });

    expect(parsed).toEqual({ text: "125", contrast: "high" });
  });

  it("returns no preferences for non-objects", ({ expect }) => {
    expect(parsePreferences(null)).toEqual({});
    expect(parsePreferences("text")).toEqual({});
  });

  it("reads stored JSON defensively", ({ expect }) => {
    expect(readPreferences(null)).toEqual({});
    expect(readPreferences("{broken")).toEqual({});
    expect(readPreferences('{"font":"readable"}')).toEqual({ font: "readable" });
  });

  it("sets and clears a single preference", ({ expect }) => {
    const set = withPreference({ text: "125" }, "theme", "dark");

    expect(set).toEqual({ text: "125", theme: "dark" });
    expect(withPreference(set, "theme", undefined)).toEqual({ text: "125" });
    expect(withPreference(set, "theme", "neon")).toEqual({ text: "125" });
  });

  it("maps preferences to root attributes", ({ expect }) => {
    const attributes = rootAttributes({ grayscale: "on" });

    expect(attributes.get("data-grayscale")).toBe("on");
    expect(attributes.get("data-theme")).toBeUndefined();
    expect(attributes.size).toBe(preferenceNames.length);
  });

  it("never returns values outside the options", ({ expect }) => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.jsonValue()), (raw) => {
        const parsed = parsePreferences(raw);
        for (const [name, value] of Object.entries(parsed)) {
          expect(preferenceNames.some((known) => known === name && isAllowed(known, value))).toBe(
            true,
          );
        }
      }),
    );
  });
});

describe("boot script", () => {
  it("applies stored preferences before the page renders", ({ expect }) => {
    const attributes = boot(JSON.stringify({ text: "150", theme: "dark", motion: "reduce" }));

    expect(attributes.get("text")).toBe("150");
    expect(attributes.get("theme")).toBe("dark");
    expect(attributes.get("motion")).toBe("reduce");
    expect(attributes.get("contrast")).toBeNull();
  });

  it("ignores values that are not allowed", ({ expect }) => {
    const attributes = boot(JSON.stringify({ text: '"><script>', theme: "neon" }));

    expect([...attributes.values()].every((value) => value === null)).toBe(true);
  });

  it("survives missing and corrupted storage", ({ expect }) => {
    expect([...boot(null).values()].every((value) => value === null)).toBe(true);
    expect([...boot("null").values()].every((value) => value === null)).toBe(true);
    expect([...boot("{oops").values()].every((value) => value === null)).toBe(true);
  });
});
