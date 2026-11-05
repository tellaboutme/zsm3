import { describe, it } from "vitest";

import { memoryBucket } from "./panel-support.ts";
import {
  type BucketSpy,
  fileStore,
  KEY,
  NOW,
  spyBucket,
  upload,
  uploadDeps,
} from "./short-link-files-support.ts";
import { docx, PDF } from "./zip-fixtures.ts";
import { createApp } from "../../src/app.ts";
import { FORM_CONTENT_TYPE } from "../../src/http/form-body.ts";
import { attachmentDisposition } from "../../src/http/media-headers.ts";
import { PASSWORD_ATTEMPTS } from "../../src/short-links/resolve.ts";
import { createFileLink } from "../../src/short-links/upload.ts";
import type { Store } from "../../src/storage/database.ts";
import { shortLinksRepo } from "../../src/storage/short-links-repo.ts";

const ORIGIN = "https://www.zespolszkolmechanicznych.edu.pl";
const app = createApp();

interface Site {
  readonly store: Store;
  readonly bucket: BucketSpy;
  readonly code: string;
  readonly post: (body: string, headers?: Record<string, string>) => Promise<Response>;
  readonly get: (path: string) => Promise<Response>;
}

async function site(
  password?: string,
  bytes: Uint8Array = PDF,
  name = "Ćwiczenia (1).pdf",
): Promise<Site> {
  const store = fileStore();
  const bucket = spyBucket(memoryBucket());
  const outcome = await createFileLink(
    uploadDeps(store, bucket),
    upload(bytes, { name, password }),
  );
  if (outcome.kind !== "created") {
    throw new Error("fixture");
  }
  const env = { DB: store.db, MEDIA: bucket, SHORT_LINK_KEY: KEY };
  return {
    store,
    bucket,
    code: outcome.code,
    post: async (body, headers = {}) =>
      app.request(
        `${ORIGIN}/api/short-links/${outcome.code}`,
        {
          method: "POST",
          headers: { "Content-Type": FORM_CONTENT_TYPE, Origin: ORIGIN, ...headers },
          body,
        },
        env,
      ),
    get: async (path) => app.request(`${ORIGIN}${path}`, {}, env),
  };
}

describe("downloading the file behind a short link", () => {
  it("streams an open file as a private attachment", async ({ expect }) => {
    const current = await site();
    const response = await current.post("");

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PDF);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-length")).toBe(String(PDF.length));
    expect(response.headers.get("content-disposition")).toBe(
      "attachment; filename=\"Cwiczenia (1).pdf\"; filename*=UTF-8''%C4%86wiczenia%20%281%29.pdf",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("location")).toBeNull();
    const [link] = await shortLinksRepo(current.store).byAuthor(
      "nauczyciel@zespolszkolmechanicznych.edu.pl",
      1,
    );
    expect(link?.clicks).toBe(1);
  });

  it("serves the media type that matches the checked content", async ({ expect }) => {
    const current = await site(undefined, docx(), "zadanie.docx");
    const response = await current.post("");

    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("asks for the password and serves the file only once it matches", async ({ expect }) => {
    const current = await site("klasa4tp-2026");
    const path = `/s/${current.code}`;

    const empty = await current.post("haslo=");
    expect(empty.status).toBe(303);
    expect(empty.headers.get("location")).toBe(`${path}?blad=haslo`);
    const wrong = await current.post("haslo=zle-haslo");
    expect(wrong.headers.get("location")).toBe(`${path}?blad=haslo`);
    expect(await wrong.text()).toBe("");
    const right = await current.post("haslo=klasa4tp-2026");
    expect(right.status).toBe(200);
    expect(new Uint8Array(await right.arrayBuffer())).toEqual(PDF);
  });

  it("stops serving after the guess limit, even for the right password", async ({ expect }) => {
    const current = await site("klasa4tp-2026");
    for (let attempt = 0; attempt < PASSWORD_ATTEMPTS; attempt += 1) {
      await current.post("haslo=zle-haslo");
    }

    const blocked = await current.post("haslo=klasa4tp-2026");
    expect(blocked.status).toBe(303);
    expect(blocked.headers.get("location")).toBe(`/s/${current.code}?blad=limit`);
  });

  it("refuses a revoked or expired link without touching the file", async ({ expect }) => {
    const current = await site();
    await shortLinksRepo(current.store).revoke(
      current.code,
      "nauczyciel@zespolszkolmechanicznych.edu.pl",
      NOW.toISOString(),
    );

    const revoked = await current.post("");
    expect(revoked.status).toBe(303);
    expect(revoked.headers.get("location")).toBe(`/s/${current.code}`);
  });

  it("sends the visitor back when the object is already gone", async ({ expect }) => {
    const current = await site();
    const [key] = current.bucket.keys();
    await current.bucket.delete(key ?? "");

    const response = await current.post("");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`/s/${current.code}?blad=plik`);
  });

  it("refuses a cross-site form, so another site cannot pull the file", async ({ expect }) => {
    const current = await site();
    const response = await current.post("", {
      Origin: "https://evil.example",
      "Sec-Fetch-Site": "cross-site",
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
  });

  it("has no direct URL for the private object", async ({ expect }) => {
    const current = await site();
    const [key] = current.bucket.keys();
    const id = (key ?? "").slice(2);

    for (const path of [
      `/media/${key ?? ""}`,
      `/media/s/${id}`,
      `/media/d/${id}`,
      `/media/d/..%2F${key ?? ""}`,
      `/media/d/${"0".repeat(64)}.pdf`,
      `/api/short-links/${current.code}`,
    ]) {
      const response = await current.get(path);
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toBe("application/problem+json");
    }
  });
});

describe("attachment names", () => {
  it("offers an ASCII fallback and an encoded UTF-8 name", ({ expect }) => {
    expect(attachmentDisposition("Zażółć gęślą jaźń.pdf")).toBe(
      "attachment; filename=\"Zazolc gesla jazn.pdf\"; filename*=UTF-8''Za%C5%BC%C3%B3%C5%82%C4%87%20g%C4%99%C5%9Bl%C4%85%20ja%C5%BA%C5%84.pdf",
    );
    expect(attachmentDisposition("Karta pracy — przykład.pdf")).toBe(
      "attachment; filename=\"Karta pracy - przyklad.pdf\"; filename*=UTF-8''Karta%20pracy%20%E2%80%94%20przyk%C5%82ad.pdf",
    );
    expect(attachmentDisposition("it's (draft)*.pdf")).toBe(
      "attachment; filename=\"it_s (draft)_.pdf\"; filename*=UTF-8''it%27s%20%28draft%29%2A.pdf",
    );
  });
});
