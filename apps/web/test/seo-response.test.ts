import { describe, it } from "vitest";

import { withQueryNoindex } from "../worker/seo-response.ts";

const html = (): Response =>
  new Response("page", { headers: { "Content-Type": "text/html; charset=utf-8" } });

describe("responses to query-bearing addresses", () => {
  it("marks duplicate HTML as noindex while keeping the body and status", async ({ expect }) => {
    const response = withQueryNoindex(
      new Request("https://example.org/kontakt?utm_source=mail"),
      html(),
    );

    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, follow");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("page");
  });

  it("recognises HTML whatever the case of its content type", ({ expect }) => {
    const response = withQueryNoindex(
      new Request("https://example.org/kontakt?x=1"),
      new Response("page", { headers: { "Content-Type": "TEXT/HTML" } }),
    );

    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, follow");
  });

  it("leaves canonical addresses untouched", ({ expect }) => {
    const page = html();

    expect(withQueryNoindex(new Request("https://example.org/kontakt"), page)).toBe(page);
  });

  it("leaves assets and responses without a content type untouched", ({ expect }) => {
    const asset = new Response("asset", { headers: { "Content-Type": "text/css" } });
    const bare = new Response(null);

    expect(withQueryNoindex(new Request("https://example.org/a.css?v=1"), asset)).toBe(asset);
    expect(withQueryNoindex(new Request("https://example.org/kontakt?x=1"), bare)).toBe(bare);
  });

  it("leaves redirects untouched and still marks the page behind them", ({ expect }) => {
    const redirect = new Response(null, {
      status: 301,
      headers: { "Content-Type": "text/html", Location: "/kontakt" },
    });
    const multiple = new Response("page", {
      status: 300,
      headers: { "Content-Type": "text/html" },
    });
    const stale = new Response("page", { status: 299, headers: { "Content-Type": "text/html" } });

    expect(withQueryNoindex(new Request("https://example.org/kontakt-2?x=1"), redirect)).toBe(
      redirect,
    );
    expect(withQueryNoindex(new Request("https://example.org/kontakt?x=1"), multiple)).toBe(
      multiple,
    );
    expect(
      withQueryNoindex(new Request("https://example.org/kontakt?x=1"), stale).headers.get(
        "X-Robots-Tag",
      ),
    ).toBe("noindex, follow");
  });
});
