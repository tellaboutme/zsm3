import { describe, it } from "vitest";

import { contentPageSchema, publicationStatusSchema, redirectSchema } from "../src/content.ts";

const body = [{ type: "paragraph", content: [{ type: "text", text: "Treść." }] }];

const page = {
  path: "/szkola/historia",
  kicker: "Szkoła",
  title: "Historia",
  intro: "Od 1950 roku.",
  sections: [
    {
      id: "kalendarium",
      title: "Kalendarium",
      blocks: [
        { type: "rich-text", document: body },
        { type: "facts", label: "Liczby", facts: [{ value: "1959", label: "siedziba" }] },
        { type: "timeline", items: [{ label: "1972", title: "ZSM3", text: "Nowa nazwa." }] },
        {
          type: "callout",
          title: "Zawody",
          text: "Zobacz ofertę.",
          link: { label: "Zawody", href: "/kandydaci/zawody" },
        },
      ],
    },
  ],
};

describe("content pages", () => {
  it("accepts every block type", ({ expect }) => {
    expect(contentPageSchema.safeParse(page).success).toBe(true);
    for (const block of page.sections[0]?.blocks ?? []) {
      const single = { ...page, sections: [{ id: "a", title: "A", blocks: [block] }] };

      expect(contentPageSchema.safeParse(single).success, block.type).toBe(true);
    }
  });

  it("accepts several facts and timeline items but not empty lists", ({ expect }) => {
    const withBlock = (block: unknown): unknown => ({
      ...page,
      sections: [{ id: "a", title: "A", blocks: [block] }],
    });
    const fact = { value: "1959", label: "siedziba" };
    const item = { label: "1972", title: "ZSM3", text: "Nowa nazwa." };

    expect(
      contentPageSchema.safeParse(withBlock({ type: "facts", label: "L", facts: [fact, fact] }))
        .success,
    ).toBe(true);
    expect(
      contentPageSchema.safeParse(withBlock({ type: "facts", label: "L", facts: [] })).success,
    ).toBe(false);
    expect(
      contentPageSchema.safeParse(withBlock({ type: "timeline", items: [item, item] })).success,
    ).toBe(true);
    expect(contentPageSchema.safeParse(withBlock({ type: "timeline", items: [] })).success).toBe(
      false,
    );
    expect(
      contentPageSchema.safeParse(withBlock({ type: "callout", title: "T", text: "X" })).success,
    ).toBe(true);
  });

  it("lives one level below a section", ({ expect }) => {
    const nested = contentPageSchema.safeParse({ ...page, path: "/szkola/historia/stara" });

    expect(nested.success).toBe(false);
    expect(nested.error?.issues[0]?.message).toBe("Content pages live one level below a section");
    expect(contentPageSchema.safeParse({ ...page, path: "/szkola" }).success).toBe(false);
  });

  it("rejects external callout links and empty sections", ({ expect }) => {
    const external = structuredClone(page);
    external.sections[0]?.blocks.push({
      type: "callout",
      title: "X",
      text: "Y",
      link: { label: "Z", href: "https://example.com" },
    });

    expect(contentPageSchema.safeParse(external).success).toBe(false);
    expect(contentPageSchema.safeParse({ ...page, sections: [] }).success).toBe(false);
    expect(
      contentPageSchema.safeParse({ ...page, sections: [{ id: "a", title: "A", blocks: [] }] })
        .success,
    ).toBe(false);
  });
});

describe("redirects and statuses", () => {
  it("map an old address to a site path", ({ expect }) => {
    expect(
      redirectSchema.safeParse({ from: "/wywiadowki/", to: "/rodzice/wywiadowki" }).success,
    ).toBe(true);
    expect(
      redirectSchema.safeParse({ from: "/2026/10/08/x/", to: "/aktualnosci/2026/x" }).success,
    ).toBe(true);
  });

  it("reject loops, external targets and whitespace", ({ expect }) => {
    const loop = redirectSchema.safeParse({ from: "/kontakt", to: "/kontakt" });

    expect(loop.success).toBe(false);
    expect(loop.error?.issues[0]?.message).toBe("A redirect cannot point to itself");
    expect(loop.error?.issues[0]?.path).toEqual(["to"]);
    expect(redirectSchema.safeParse({ from: "abc/def", to: "/b" }).success).toBe(false);
    expect(redirectSchema.safeParse({ from: "/a", to: "https://evil.example" }).success).toBe(
      false,
    );
    expect(redirectSchema.safeParse({ from: "/a b", to: "/b" }).success).toBe(false);
    expect(redirectSchema.safeParse({ from: "a", to: "/b" }).success).toBe(false);
  });

  it("knows draft and published content", ({ expect }) => {
    expect(publicationStatusSchema.options).toEqual(["draft", "published"]);
  });
});
