import { describe, it } from "vitest";

import {
  DISMISSED_KEY,
  dayOffAnnouncement,
  publicAnnouncement,
  readDismissed,
  withDismissed,
} from "../src/lib/announcement.ts";
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

describe("published announcements", () => {
  it("keys the banner by its version so an edited notice shows again", ({ expect }) => {
    const stored = {
      id: "01920000-0000-7000-8000-000000000001",
      updatedAt: "2026-10-22T08:00:00.000Z",
      severity: "urgent",
      text: "Szkoła zamknięta.",
      startsOn: "2026-10-22",
      endsOn: "2026-10-22",
    } as const;
    expect(publicAnnouncement(stored)).toEqual({
      id: "01920000-0000-7000-8000-000000000001.2026-10-22T08:00:00.000Z",
      severity: "urgent",
      text: "Szkoła zamknięta.",
    });
    expect(
      publicAnnouncement({ ...stored, link: { label: "Więcej", href: "/kontakt" } }).link,
    ).toEqual({ label: "Więcej", href: "/kontakt" });
  });
});

describe("day-off notices", () => {
  const daysOff = [{ from: "2026-11-02", to: "2026-11-03", title: "Dni wolne" }];

  it("announces a day off on the day and the day before", ({ expect }) => {
    expect(dayOffAnnouncement(daysOff, "2026-11-01", "2026-11-02")).toEqual({
      id: "wolne.2026-11-02.Jutro",
      severity: "info",
      text: "Jutro nie ma zajęć: Dni wolne.",
      link: { label: "Terminarz", href: "/szkola/terminarz" },
    });
    expect(dayOffAnnouncement(daysOff, "2026-11-03", "2026-11-04")?.text).toBe(
      "Dziś nie ma zajęć: Dni wolne.",
    );
    expect(dayOffAnnouncement(daysOff, "2026-11-02", "2026-11-03")?.id).toBe(
      "wolne.2026-11-02.Dziś",
    );
    expect(dayOffAnnouncement(daysOff, "2026-10-30", "2026-10-31")).toBeUndefined();
  });
});
