import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { createApp } from "../../src/app.ts";
import { FORM_CONTENT_TYPE, isFormBody } from "../../src/http/form-body.ts";
import { hashPassword } from "../../src/security/passwords.ts";
import type { SqlDatabase, Store } from "../../src/storage/database.ts";
import { shortLinksRepo } from "../../src/storage/short-links-repo.ts";

const ORIGIN = "https://www.zespolszkolmechanicznych.edu.pl";
const KEY = "short-link-pepper-0123456789-0123456789";
const TARGET = "https://example.org/materialy/lekcja.pdf";
const FORM = FORM_CONTENT_TYPE;

const app = createApp();

interface PostOptions {
  readonly contentType?: string;
  readonly origin?: string | null;
  readonly noKey?: boolean;
  readonly noContentType?: boolean;
  readonly fetchSite?: string;
}

function harness() {
  const db: SqlDatabase = memoryDatabase();
  const store: Store = { db, clock: FIXED_CLOCK, random: counterRandom() };
  const post = async (
    code: string,
    body: string,
    {
      contentType = FORM,
      origin = ORIGIN,
      noKey = false,
      noContentType = false,
      fetchSite,
    }: PostOptions = {},
  ): Promise<Response> =>
    await app.request(
      `${ORIGIN}/api/short-links/${code}`,
      {
        method: "POST",
        headers: {
          ...(noContentType ? {} : { "Content-Type": contentType }),
          ...(origin === null ? {} : { Origin: origin }),
          ...(fetchSite === undefined ? {} : { "Sec-Fetch-Site": fetchSite }),
        },
        body,
      },
      {
        DB: db,
        SHORT_LINK_KEY: noKey ? undefined : KEY,
        MEDIA: { get: async () => await Promise.resolve(null) },
      },
    );
  return { store, post };
}

async function seed(store: Store, code: string, password: string | undefined): Promise<void> {
  await shortLinksRepo(store).create({
    code,
    target: TARGET,
    password: password === undefined ? null : await hashPassword(KEY, password, counterRandom()),
    createdBy: "nauczyciel@zespolszkolmechanicznych.edu.pl",
    expiresAt: "2027-10-27T08:00:00.000Z",
  });
}

describe("the body a form sends", () => {
  it("is recognised only when the browser says so", ({ expect }) => {
    expect(isFormBody(FORM_CONTENT_TYPE)).toBe(true);
    expect(isFormBody(`${FORM_CONTENT_TYPE}; charset=UTF-8`)).toBe(true);
    expect(isFormBody("application/json")).toBe(false);
    expect(isFormBody(undefined)).toBe(false);
  });
});

describe("checking a short link password", () => {
  it("sends the visitor on to the material", async ({ expect }) => {
    const h = harness();
    await seed(h.store, "k7mq4ra", "klasa4tp");

    const response = await h.post("k7mq4ra", "haslo=klasa4tp");

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(TARGET);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("opens a link that never had a password", async ({ expect }) => {
    const h = harness();
    await seed(h.store, "k7mq4ra", undefined);

    const response = await h.post("k7mq4ra", "haslo=cokolwiek");

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(TARGET);
  });

  it("sends a wrong password back to the form", async ({ expect }) => {
    const h = harness();
    await seed(h.store, "k7mq4ra", "klasa4tp");

    const response = await h.post("k7mq4ra", "haslo=zle");

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/s/k7mq4ra?blad=haslo");
  });

  it("sends an empty field back to the form without a complaint", async ({ expect }) => {
    const h = harness();
    await seed(h.store, "k7mq4ra", "klasa4tp");

    expect((await h.post("k7mq4ra", "haslo=")).headers.get("Location")).toBe(
      "/s/k7mq4ra?blad=haslo",
    );
  });

  it("reports a missing server key", async ({ expect }) => {
    const h = harness();
    await seed(h.store, "k7mq4ra", "klasa4tp");

    const response = await h.post("k7mq4ra", "haslo=klasa4tp", { noKey: true });

    expect(response.headers.get("Location")).toBe("/s/k7mq4ra?blad=brak");
  });

  it("sends an unknown or lapsed code to the page that explains it", async ({ expect }) => {
    const h = harness();

    expect((await h.post("k7mq4ra", "haslo=klasa4tp")).headers.get("Location")).toBe("/s/k7mq4ra");
  });

  it("keeps a slash out of the redirect it builds", async ({ expect }) => {
    const h = harness();

    expect((await h.post("..%2Fpanel", "haslo=x")).headers.get("Location")).toBe("/s/..%2Fpanel");
  });

  it("accepts a form the browser marks as same-origin without an origin header", async ({
    expect,
  }) => {
    const h = harness();
    await seed(h.store, "k7mq4ra", "klasa4tp");

    const response = await h.post("k7mq4ra", "haslo=klasa4tp", {
      origin: null,
      fetchSite: "same-origin",
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(TARGET);
  });

  it("refuses a form the browser marks as cross-site", async ({ expect }) => {
    const h = harness();
    await seed(h.store, "k7mq4ra", "klasa4tp");

    expect(
      (await h.post("k7mq4ra", "haslo=klasa4tp", { origin: null, fetchSite: "cross-site" })).status,
    ).toBe(403);
    expect(
      (await h.post("k7mq4ra", "haslo=klasa4tp", { origin: null, fetchSite: "none" })).status,
    ).toBe(403);
  });

  it("refuses a request from another site", async ({ expect }) => {
    const h = harness();
    await seed(h.store, "k7mq4ra", "klasa4tp");

    expect(
      (await h.post("k7mq4ra", "haslo=klasa4tp", { origin: "https://zly.example" })).status,
    ).toBe(403);
    expect((await h.post("k7mq4ra", "haslo=klasa4tp", { origin: null })).status).toBe(403);
    expect((await h.post("k7mq4ra", "haslo=klasa4tp", { origin: "nie-adres" })).status).toBe(403);
  });

  it("refuses a body that is not a form", async ({ expect }) => {
    const h = harness();
    await seed(h.store, "k7mq4ra", "klasa4tp");

    expect(
      (await h.post("k7mq4ra", '{"haslo":"klasa4tp"}', { contentType: "application/json" })).status,
    ).toBe(415);
    expect((await h.post("k7mq4ra", "haslo=klasa4tp", { noContentType: true })).status).toBe(415);
  });
});
