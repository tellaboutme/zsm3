import { describe, it } from "vitest";

import { DISMISSED_KEY, readDismissed, withDismissed } from "../src/lib/announcement.ts";
import { nextTheme, themeLabel } from "../src/lib/theme.ts";

describe("theme cycle", () => {
  it("goes system, light, dark and back to system", ({ expect }) => {
    expect(nextTheme(undefined)).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBeUndefined();
    expect(nextTheme("neon")).toBeUndefined();
  });

  it("labels every theme in Polish", ({ expect }) => {
    expect(themeLabel(undefined)).toBe("Motyw: systemowy");
    expect(themeLabel("light")).toBe("Motyw: jasny");
    expect(themeLabel("dark")).toBe("Motyw: ciemny");
    expect(themeLabel("neon")).toBe("Motyw: systemowy");
  });
});

describe("dismissed announcements", () => {
  it("uses a stable session key", ({ expect }) => {
    expect(DISMISSED_KEY).toBe("zsm3.dismissed-banners");
  });

  it("reads stored ids defensively", ({ expect }) => {
    expect([...readDismissed(null)]).toEqual([]);
    expect([...readDismissed("{oops")]).toEqual([]);
    expect([...readDismissed('{"a":1}')]).toEqual([]);
    expect([...readDismissed('["a", 2, "b"]')]).toEqual(["a", "b"]);
  });

  it("adds an id once", ({ expect }) => {
    expect(withDismissed(new Set(["a"]), "b")).toBe('["a","b"]');
    expect(withDismissed(new Set(["a"]), "a")).toBe('["a"]');
  });
});
