import { describe, it } from "vitest";

import { panelSections } from "../src/data/panel-sections.ts";
import {
  OVERVIEW_TASKS,
  SECTION_GROUPS,
  canOpenOverview,
  countLabel,
  sectionsIn,
  tasksFor,
} from "../src/lib/panel/overview.ts";

describe("panel overview tasks", () => {
  it("shows each role only the counters it can open", ({ expect }) => {
    const names = (role: string): readonly string[] => tasksFor(role).map((task) => task.task);

    expect(names("admin")).toEqual(["requests", "drafts"]);
    expect(names("secretariat")).toEqual(["requests", "drafts"]);
    expect(names("editor")).toEqual(["drafts"]);
    expect(names("counsellor")).toEqual(["questions"]);
    expect(names("gallery_editor")).toEqual([]);
    expect(names("")).toEqual([]);
  });

  it("asks the API only for the items that wait for staff", ({ expect }) => {
    expect(OVERVIEW_TASKS.map((task) => [task.path, task.href, task.label])).toEqual([
      ["/api/panel/requests?status=submitted&limit=50", "/panel/wnioski", "Nowe wnioski"],
      ["/api/panel/questions?status=received", "/panel/skrzynka", "Pytania do odpowiedzi"],
      ["/api/panel/news?status=draft&pageSize=1", "/panel/aktualnosci", "Szkice aktualności"],
    ]);
  });

  it("opens for every role that has at least one section", ({ expect }) => {
    const roles = ["admin", "secretariat", "editor", "gallery_editor", "counsellor", "", "guest"];

    expect(roles.map((role) => canOpenOverview(panelSections, role))).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(canOpenOverview([{}], "guest")).toBe(true);
    expect(canOpenOverview([{}], "")).toBe(false);
    expect(canOpenOverview([], "admin")).toBe(false);
  });

  it("marks a count that has more on the next page", ({ expect }) => {
    expect(countLabel(0, false)).toBe("0");
    expect(countLabel(7, false)).toBe("7");
    expect(countLabel(50, true)).toBe("50+");
  });
});

describe("panel overview groups", () => {
  it("places every section in exactly one group, in order", ({ expect }) => {
    const grouped = SECTION_GROUPS.flatMap((group) => sectionsIn(panelSections, group.id));

    expect(SECTION_GROUPS.map((group) => group.title)).toEqual([
      "Treści strony",
      "Uczniowie i rodzice",
      "Administracja",
    ]);
    expect(grouped).toHaveLength(panelSections.length);
    expect(new Set(grouped)).toEqual(new Set(panelSections));
    expect(sectionsIn(panelSections, "admin").map((section) => section.short)).toEqual([
      "Pracownicy",
      "Dziennik",
      "Przekierowania",
    ]);
  });

  it("describes every section in one short line", ({ expect }) => {
    for (const section of panelSections) {
      expect(section.note.length, section.short).toBeGreaterThan(0);
      expect(section.note.length, section.short).toBeLessThanOrEqual(60);
    }
  });
});
