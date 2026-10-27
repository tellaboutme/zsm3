import type { ContentPage } from "@zsm3/contracts/content";
import { it } from "vitest";

import { drafts } from "../src/lib/panel/document.ts";
import { newsSave, newsStatus, pageSave } from "../src/lib/panel/mutations.ts";
import { newsCandidate } from "../src/lib/panel/news-edit.ts";
import {
  emptySection,
  keptLabel,
  newPageDraft,
  pageCandidate,
  pageDrafts,
  type PageDraft,
} from "../src/lib/panel/page-edit.ts";
import { validationPhrases } from "../src/lib/panel/validation.ts";

const FIELDS = {
  slug: " szkola-po-urgencji ",
  date: "2026-03-02",
  category: "Wydarzenia",
  title: "Lekcja otwarta",
  lead: "Podsumowanie dnia próbnego.",
  caption: "Warsztat",
  credit: "A. Nowak",
};

it("builds a valid news item from form fields", ({ expect }) => {
  const candidate = newsCandidate(FIELDS, [{ kind: "paragraph", text: "Treść dnia próbnego." }]);
  expect(candidate.ok).toBe(true);
  if (candidate.ok && candidate.item !== undefined) {
    expect(candidate.item.slug).toBe("szkola-po-urgencji");
    expect(candidate.item.cover).toEqual({ caption: "Warsztat", credit: "A. Nowak" });
    expect(newsSave(candidate.item)).toEqual({
      entity: "news",
      mutation: { action: "save", item: candidate.item },
    });
    expect(newsStatus("unpublish")).toEqual({ entity: "news", mutation: { action: "unpublish" } });
  }
});

it("reports invalid fields on the item candidate", ({ expect }) => {
  const bad = newsCandidate({ ...FIELDS, slug: "ZłaNazwa", date: "jutro" }, [
    { kind: "paragraph", text: "Treść." },
  ]);
  expect(bad.ok).toBe(false);
  expect(bad.issues.length).toBeGreaterThan(0);
});

it("reports an incomplete body", ({ expect }) => {
  const empty = newsCandidate(FIELDS, [{ kind: "paragraph", text: "" }]);
  expect(empty.ok).toBe(false);
  expect(empty.issues).toEqual(["Blok 1 jest niepełny"]);
});

it("phrases missing fields without a cover", ({ expect }) => {
  const bare = newsCandidate({}, [{ kind: "paragraph", text: "Treść." }]);
  expect(bare.ok).toBe(false);
  expect(bare.issues.length).toBeGreaterThan(0);
  const sketchy = {
    slug: FIELDS.slug,
    date: FIELDS.date,
    category: FIELDS.category,
    title: FIELDS.title,
    lead: FIELDS.lead,
    caption: "Warsztat",
  };
  const spare = newsCandidate(sketchy, [{ kind: "paragraph", text: "Treść." }]);
  expect(spare.ok).toBe(true);
  if (spare.ok && spare.item !== undefined) {
    expect(spare.item.cover).toEqual({ caption: "Warsztat" });
  }
  const noCredit = newsCandidate({ ...FIELDS, credit: "" }, [
    { kind: "paragraph", text: "Treść." },
  ]);
  expect(noCredit.ok).toBe(true);
  if (noCredit.ok && noCredit.item !== undefined) {
    expect(noCredit.item.cover).toEqual({ caption: "Warsztat" });
  }
});

const SAMPLE_PAGE: ContentPage = {
  path: "/kontakt",
  kicker: "Kontakt",
  title: "Kontakt",
  intro: "Adresy i telefony.",
  sections: [
    {
      id: "opis",
      title: "Opis",
      blocks: [
        {
          type: "rich-text",
          document: [{ type: "paragraph", content: [{ type: "text", text: "Dyżury." }] }],
        },
        {
          type: "facts",
          label: "Liczby",
          facts: [
            { value: "3", label: "Telefony" },
            { value: "2", label: "Sekretariaty" },
          ],
        },
      ],
    },
  ],
};

it("wraps saved page sections in editable rows", ({ expect }) => {
  const cards = pageDrafts(SAMPLE_PAGE, "draft");
  expect(cards.status).toBe("draft");
  const section = cards.sections[0];
  if (section === undefined) {
    throw new Error("section missing");
  }
  expect(section.rows).toHaveLength(2);
  expect(section.rows[1]).toMatchObject({ rich: false, label: "Liczby" });
});

it("labels section extras sparingly", ({ expect }) => {
  expect(keptLabel("facts")).toBe("Liczby");
  expect(keptLabel("timeline")).toBe("Oś czasu");
  expect(keptLabel("callout")).toBe("Wyróżnienie");
  expect(keptLabel("files")).toBe("Pliki");
  expect(keptLabel("gallery")).toBe("Blok");
});

it("phrases path shapes of validation issues", ({ expect }) => {
  expect(
    validationPhrases([
      { code: "invalid_type", path: "title" },
      { code: "too_big", path: ["body", 1] },
      { code: "unrecognized_keys", path: 9 },
      { code: "weird", path: "kicker" },
    ]),
  ).toEqual([
    "wartość ma zły typ",
    "Treść: wartość jest za długa",
    "pole nie przyjmuje tego wpisu",
    "sprawdź wartość",
  ]);
});

it("collects a page candidate with preserved non-text blocks", ({ expect }) => {
  const cards = pageDrafts(SAMPLE_PAGE, "published");
  const candidate = pageCandidate(cards, {
    path: "/kontakt",
    "section-0-id": " opis-projektu ",
    "section-0-title": "Opis projektu",
  });
  expect(candidate.ok).toBe(true);
  if (candidate.ok && candidate.page !== undefined) {
    expect(candidate.page.sections[0]?.id).toBe("opis-projektu");
    expect(candidate.page.sections[0]?.title).toBe("Opis projektu");
    expect(candidate.page.sections[0]?.blocks[1]).toBeTypeOf("object");
    expect(pageSave(candidate.page, "published")).toEqual({
      entity: "pages",
      action: "save",
      page: candidate.page,
      status: "published",
    });
  }
});

it("rejects sections with incomplete text", ({ expect }) => {
  const stub = newPageDraft("/nowa");
  expect(stub.sections[0]).toEqual({
    id: "sekcja-1",
    title: "",
    rows: [{ rich: true, drafts: [] }],
  });
  const candidate = pageCandidate(stub, {});
  expect(candidate.ok).toBe(false);
  expect(candidate.issues[0]).toContain("niepełny");
});

const FULL_DRAFT: PageDraft = {
  ...newPageDraft("/nowa"),
  kicker: "Nadtytuł",
  title: "Tytuł",
  intro: "Wstęp strony.",
  sections: [
    {
      id: "sekcja-1",
      title: "Sekcja",
      rows: [
        {
          rich: true,
          drafts: drafts([{ type: "paragraph", content: [{ type: "text", text: "Tekst." }] }]),
        },
      ],
    },
  ],
};

it("phrases schema problems of the page", ({ expect }) => {
  const candidate = pageCandidate(FULL_DRAFT, { path: "nie-ścieżka" });
  expect(candidate.ok).toBe(false);
  expect(candidate.issues[0]).toContain("Ścieżka");
});

it("keeps complete pages collectable", ({ expect }) => {
  const candidate = pageCandidate(FULL_DRAFT, {});
  expect(candidate.ok).toBe(true);
  expect(emptySection(3).id).toBe("sekcja-4");
});
