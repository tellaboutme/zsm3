import type { SchoolEvent } from "@zsm3/contracts/content";
import { schoolYearLabel } from "@zsm3/contracts/panel";
import { it, vi } from "vitest";

import "./panel-window.ts";
import { schoolYearFor } from "../src/lib/panel/events.ts";
import { wireTerminarz } from "../src/scripts/panel/terminarz.ts";

interface Seen {
  readonly method: string;
  readonly path: string;
  readonly payload: unknown;
}

interface Answer {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: { readonly get: (name: string) => string };
  readonly json: () => unknown;
}

function jsonOf(data: unknown): Answer {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: () => data,
  };
}

function stubFetch(responses: readonly Answer[]): readonly Seen[] {
  const seen: { method: string; path: string; payload: unknown }[] = [];
  const queue = [...responses];
  const fetcher = (path: unknown, init?: RequestInit): unknown => {
    const method = init?.method ?? "GET";
    const raw = init?.body;
    seen.push({
      method,
      path: String(path),
      payload: typeof raw === "string" ? JSON.parse(raw) : raw,
    });
    return queue.shift() ?? jsonOf({ ok: true });
  };
  vi.stubGlobal("fetch", fetcher);
  return seen;
}

function buildSection(): HTMLElement {
  const section = document.createElement("div");
  const holder = document.createElement("label");
  const year = document.createElement("select");
  year.dataset["part"] = "year";
  holder.append(year);
  const rows = document.createElement("ul");
  rows.dataset["panel"] = "event-rows";
  const status = document.createElement("p");
  status.dataset["panel"] = "status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const add = document.createElement("button");
  add.dataset["panel"] = "event-add";
  const save = document.createElement("button");
  save.dataset["panel"] = "event-save";
  section.append(holder, add, save, rows, status);
  document.body.append(section);
  return section;
}

function part(section: HTMLElement, name: string): HTMLElement {
  const node = section.querySelector<HTMLElement>(`[data-panel="${name}"]`);
  if (node === null) {
    throw new Error(`missing ${name}`);
  }
  return node;
}

const PASOWANIE: SchoolEvent = {
  date: "2026-10-01",
  title: "Pasowanie",
  audience: "Wszyscy",
  kind: "uroczystosc",
};

it("saves an empty year after an armed confirmation", async ({ expect }) => {
  const label = schoolYearLabel(schoolYearFor(new Date()));
  const seen = stubFetch([jsonOf({ items: [] }), jsonOf({ ok: true })]);
  const section = buildSection();
  wireTerminarz(section);
  const status = part(section, "status");
  await vi.waitFor(() => {
    expect(status.textContent).toContain(`Wydarzenia w roku ${label}: 0`);
  });
  expect(status.getAttribute("aria-live")).toBe("polite");
  const save = part(section, "event-save");
  save.click();
  const arm = section.querySelector<HTMLButtonElement>(".panel-save-empty");
  expect(arm?.hidden).toBe(false);
  expect(document.activeElement).toBe(arm);
  expect(seen.filter((request) => request.method === "PUT")).toHaveLength(0);
  arm?.click();
  await vi.waitFor(() => {
    expect(status.textContent).toContain("zapisano rok bez wydarzeń");
  });
  expect(seen).toHaveLength(2);
  expect(seen[1]).toEqual({
    method: "PUT",
    path: `/api/panel/events/${String(schoolYearFor(new Date()))}`,
    payload: { entity: "events", events: [] },
  });
  expect(arm?.hidden).toBe(true);
});

it("saves populated years without the confirmation step", async ({ expect }) => {
  const seen = stubFetch([jsonOf({ items: [PASOWANIE] }), jsonOf({ ok: true })]);
  const section = buildSection();
  wireTerminarz(section);
  await vi.waitFor(() => {
    expect(section.querySelector<HTMLElement>(".panel-event")).not.toBeNull();
  });
  expect(seen.filter((request) => request.method === "PUT")).toHaveLength(0);
  expect(section.querySelector<HTMLButtonElement>(".panel-save-empty")?.hidden).toBe(true);
  part(section, "event-save").click();
  await vi.waitFor(() => {
    expect(seen).toHaveLength(2);
  });
  expect(seen[1]).toEqual({
    method: "PUT",
    path: `/api/panel/events/${String(schoolYearFor(new Date()))}`,
    payload: { entity: "events", events: [PASOWANIE] },
  });
  expect(section.querySelector<HTMLButtonElement>(".panel-save-empty")?.hidden).toBe(true);
});

it("allows note lines as long as the contract permits", async ({ expect }) => {
  stubFetch([jsonOf({ items: [] })]);
  const section = buildSection();
  wireTerminarz(section);
  await vi.waitFor(() => {
    expect(part(section, "status").textContent).toContain("Wydarzenia w roku");
  });
  part(section, "event-add").click();
  const row = section.querySelector<HTMLElement>(".panel-event");
  const note = row?.querySelector<HTMLInputElement>('[data-part="note"]');
  const title = row?.querySelector<HTMLInputElement>('[data-part="title"]');
  expect(note?.getAttribute("maxlength")).toBe("300");
  expect(title?.getAttribute("maxlength")).toBe("200");
});

it("disarms the empty-year confirmation once a row is added", async ({ expect }) => {
  stubFetch([jsonOf({ items: [] })]);
  const section = buildSection();
  wireTerminarz(section);
  await vi.waitFor(() => {
    expect(part(section, "status").textContent).toContain("Wydarzenia w roku");
  });
  part(section, "event-save").click();
  const arm = section.querySelector<HTMLButtonElement>(".panel-save-empty");
  expect(arm?.hidden).toBe(false);
  part(section, "event-add").click();
  expect(arm?.hidden).toBe(true);
});
