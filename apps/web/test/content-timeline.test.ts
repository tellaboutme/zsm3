import { describe, it } from "vitest";

import { timelineLabel } from "../src/lib/content.ts";

describe("timeline labels", () => {
  const item = (label: string, title: string) => ({ label, title, text: "" });

  it("keeps a year as data", ({ expect }) => {
    expect(timelineLabel(item(" 1881 ", "Narodziny patrona"))).toEqual({
      text: "1881",
      data: true,
    });
  });

  it("keeps a word label that adds information", ({ expect }) => {
    expect(timelineLabel(item("Biblioteka", "Godziny pracy"))).toEqual({
      text: "Biblioteka",
      data: false,
    });
  });

  it("drops a label the title already starts with", ({ expect }) => {
    expect(timelineLabel(item("Pedagog", "Pedagog szkolny"))).toBeUndefined();
    expect(timelineLabel(item("psycholog", "Psycholog szkolny"))).toBeUndefined();
  });

  it("drops an empty label", ({ expect }) => {
    expect(timelineLabel(item("  ", "Cokolwiek"))).toBeUndefined();
  });
});
