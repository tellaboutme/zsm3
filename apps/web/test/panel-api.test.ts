import { createServer, type Server, type ServerResponse } from "node:http";

import { Window } from "happy-dom";
import { it } from "vitest";

import { DEV_TOKEN_KEY, panelDelete, panelRead, panelSend } from "../src/lib/panel/api.ts";
import { PANEL_SCHEMAS, parse } from "../src/lib/panel/models.ts";
import {
  announcementSave,
  bellsSave,
  datasetSave,
  eventsSave,
  newsStatus,
  redirectSave,
  staffSave,
} from "../src/lib/panel/mutations.ts";

it("reads the parsed panel payloads", ({ expect }) => {
  expect(parse(PANEL_SCHEMAS.me, { email: "a@zsm3.pl", role: "admin" })).toEqual({
    email: "a@zsm3.pl",
    role: "admin",
  });
  expect(parse(PANEL_SCHEMAS.me, { email: "a@zsm3.pl", role: "krul" })).toBeUndefined();
  expect(
    parse(PANEL_SCHEMAS.newsList, { items: [], total: 0, page: 1, pageSize: 20 }),
  ).toMatchObject({ total: 0 });
  expect(parse(PANEL_SCHEMAS.pageList, { items: [] })).toEqual({ items: [] });
  expect(parse(PANEL_SCHEMAS.eventList, { items: [] })).toEqual({ items: [] });
  expect(parse(PANEL_SCHEMAS.fileList, { items: [] })).toEqual({ items: [] });
  expect(parse(PANEL_SCHEMAS.upload, { item: {} })).toBeUndefined();
  expect(parse(PANEL_SCHEMAS.redirectList, { items: [] })).toEqual({ items: [] });
  expect(parse(PANEL_SCHEMAS.newsView, { item: {} })).toBeUndefined();
});

it("packs the remaining mutations", ({ expect }) => {
  expect(
    eventsSave([
      { date: "2026-09-01", title: "Zajęcia", audience: "Wszyscy", kind: "rok-szkolny" },
    ]),
  ).toEqual({
    entity: "events",
    events: [{ date: "2026-09-01", title: "Zajęcia", audience: "Wszyscy", kind: "rok-szkolny" }],
  });
  expect(
    announcementSave({ severity: "info", text: "A", startsOn: "2026-10-26", endsOn: "2026-10-26" })
      .entity,
  ).toBe("announcements");
  expect(
    bellsSave({ regular: [{ start: "08:00", end: "08:45" }], variants: [], days: [] }).entity,
  ).toBe("bells");
  expect(datasetSave("partnerzy", [])).toEqual({ entity: "datasets", key: "partnerzy", data: [] });
  expect(staffSave({ email: "a@zsm3.pl", role: "editor", active: true })).toEqual({
    entity: "staff",
    item: { email: "a@zsm3.pl", role: "editor", active: true },
  });
  expect(redirectSave({ from: "/stara", to: "/nowa" })).toEqual({
    entity: "redirects",
    item: { from: "/stara", to: "/nowa" },
  });
  expect(newsStatus("publish")).toEqual({ entity: "news", mutation: { action: "publish" } });
});

it("reads and sends live payloads", async ({ expect }) => {
  const hits: string[] = [];
  const server: Server = createServer((request, response: ServerResponse) => {
    const parts = [request.method, request.url, request.headers["content-type"]];
    hits.push(parts.map((part) => part ?? "-").join(" "));
    const url = request.url ?? "/none";
    respond(url, response);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  const base = `http://127.0.0.1:${String(port)}`;

  await expect(panelRead(`${base}/ok`)).resolves.toMatchObject({
    status: 200,
    ok: true,
    data: { email: "n@zsm3.pl", role: "admin" },
  });
  await expect(panelRead(`${base}/problem`)).resolves.toMatchObject({ status: 422, ok: false });
  await expect(panelRead(`${base}/text`)).resolves.toMatchObject({ status: 200, data: undefined });
  await expect(panelRead(`${base}/broken`)).resolves.toMatchObject({
    status: 200,
    ok: true,
    data: undefined,
  });
  await expect(panelRead(`${base}/bare`)).resolves.toMatchObject({
    status: 404,
    ok: false,
    data: undefined,
  });
  await expect(panelRead(`${base}/charset`)).resolves.toMatchObject({
    status: 200,
    data: { total: 0 },
  });
  await expect(panelSend("PUT", `${base}/none`, { a: 1 })).resolves.toMatchObject({
    status: 204,
    data: undefined,
  });
  await expect(panelDelete(`${base}/none`)).resolves.toMatchObject({ status: 204, ok: true });
  expect(hits.some((hit) => hit.startsWith("PUT "))).toBe(true);
  expect(hits.some((hit) => hit.includes("application/json"))).toBe(true);
  server.close();
});

it("sends the local dev access token header when the session stores one", async ({ expect }) => {
  const assertions: string[] = [];
  const server: Server = createServer((request, response: ServerResponse) => {
    const raw = request.headers["cf-access-jwt-assertion"];
    assertions.push(typeof raw === "string" ? raw : "brak");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ email: "dev@zsm3.local", role: "admin" }));
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  const base = `http://127.0.0.1:${String(port)}`;
  const storage = new Window({ url: "http://panel.local/" }).sessionStorage;
  Reflect.set(globalThis, "sessionStorage", storage);
  try {
    storage.setItem(DEV_TOKEN_KEY, "   ");
    await panelRead(`${base}/dev`);
    expect(assertions).toEqual(["brak"]);

    storage.setItem(DEV_TOKEN_KEY, " tok-dev ");
    await panelRead(`${base}/dev`);
    await panelSend("PUT", `${base}/dev`, { a: 1 });
    await panelDelete(`${base}/dev`);
    expect(assertions).toEqual(["brak", "tok-dev", "tok-dev", "tok-dev"]);

    storage.removeItem(DEV_TOKEN_KEY);
    await panelRead(`${base}/dev`);
    expect(assertions).toEqual(["brak", "tok-dev", "tok-dev", "tok-dev", "brak"]);
  } finally {
    Reflect.deleteProperty(globalThis, "sessionStorage");
    server.close();
  }
});

function respond(url: string, response: ServerResponse): void {
  if (url === "/ok") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ email: "n@zsm3.pl", role: "admin" }));
    return;
  }
  if (url === "/problem") {
    response.writeHead(422, { "Content-Type": "application/problem+json" });
    response.end(JSON.stringify({ title: "Unprocessable Content", status: 422 }));
    return;
  }
  if (url === "/text") {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("ciężki");
    return;
  }
  if (url === "/broken") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end("[1,2");
    return;
  }
  if (url === "/bare") {
    response.writeHead(404);
    response.end("brak");
    return;
  }
  if (url === "/charset") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ total: 0, items: [], page: 1, pageSize: 20 }));
    return;
  }
  response.writeHead(204);
  response.end();
}
