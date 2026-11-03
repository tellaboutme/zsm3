import { describe, it } from "vitest";

import {
  eventsSaveMutation,
  newsSaveMutation,
  newsStatusMutation,
  pageSaveMutation,
  redirectSaveMutation,
  sampleEvent,
  sampleNews,
  samplePage,
} from "./panel-fixtures.ts";
import {
  eventsSave,
  newsMutation,
  newsPublish,
  pageSave,
  redirectSave,
} from "../../src/routes/panel/mutations.ts";

const NEWS = sampleNews("istniejacy", "Istniejacy salon");
const PAGE = samplePage("/kontakt", "Kontakt");

describe("panel mutation narrowing", () => {
  it("answers undefined for missing payloads", ({ expect }) => {
    expect(newsMutation(undefined)).toBeUndefined();
    expect(newsPublish(undefined)).toBeUndefined();
    expect(pageSave(undefined)).toBeUndefined();
    expect(eventsSave(undefined)).toBeUndefined();
    expect(redirectSave(undefined)).toBeUndefined();
  });

  it("narrow news mutations by action", ({ expect }) => {
    expect(newsMutation(newsSaveMutation(NEWS, 4))).toEqual({ item: NEWS, expectedRevision: 4 });
    expect(newsMutation(newsSaveMutation(NEWS))).toEqual({ item: NEWS, expectedRevision: null });
    expect(newsMutation(newsStatusMutation("publish"))).toBeUndefined();
    expect(newsPublish(newsSaveMutation(NEWS))).toBeUndefined();
    expect(newsPublish(newsStatusMutation("publish", 2))).toEqual({
      action: "publish",
      expectedRevision: 2,
    });
    expect(newsPublish(newsStatusMutation("unpublish", 3))).toEqual({
      action: "unpublish",
      expectedRevision: 3,
    });
  });

  it("narrows foreign entities to undefined", ({ expect }) => {
    const news = newsSaveMutation(NEWS);
    const page = pageSaveMutation(PAGE, "draft");
    const events = eventsSaveMutation([sampleEvent("2026-09-15", "Rozpoczecie roku")]);
    const redirect = redirectSaveMutation({ from: "/nowa-wizytowka", to: "/kontakt" });

    expect(newsMutation(page)).toBeUndefined();
    expect(newsMutation(redirect)).toBeUndefined();
    expect(newsPublish(page)).toBeUndefined();
    expect(newsPublish(events)).toBeUndefined();
    expect(pageSave(news)).toBeUndefined();
    expect(pageSave(events)).toBeUndefined();
    expect(pageSave(page)).toEqual({ page: PAGE, status: "draft", expectedRevision: null });
    expect(pageSave(pageSaveMutation(PAGE, "published", 5))).toEqual({
      page: PAGE,
      status: "published",
      expectedRevision: 5,
    });
    expect(eventsSave(news)).toBeUndefined();
    expect(eventsSave(page)).toBeUndefined();
    expect(redirectSave(news)).toBeUndefined();
    expect(redirectSave(events)).toBeUndefined();
    expect(redirectSave(redirect)).toEqual({ from: "/nowa-wizytowka", to: "/kontakt" });
  });
});
