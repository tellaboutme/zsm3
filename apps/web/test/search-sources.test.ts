import { describe, it } from "vitest";

import {
  bellsEntry,
  classEntries,
  contactEntry,
  contentPageEntry,
  staffEntry,
} from "../src/lib/search-sources.ts";

describe("search sources", () => {
  it("indexes every block of a content page", ({ expect }) => {
    expect(
      contentPageEntry({
        path: "/szkola/historia",
        kicker: "Szkoła",
        title: "Historia",
        intro: "Wstęp.",
        sections: [
          {
            id: "a",
            title: "Początki",
            blocks: [
              {
                type: "rich-text",
                document: [{ type: "paragraph", content: [{ type: "text", text: "Rok 1957." }] }],
              },
              { type: "facts", label: "Liczby", facts: [{ value: "15", label: "kierunków" }] },
              {
                type: "timeline",
                items: [
                  { label: "1960", title: "Nowy budynek", text: "Hala." },
                  { label: "1970", title: "Warsztaty", text: "Tokarki." },
                ],
              },
              { type: "callout", title: "Uwaga", text: "Archiwum." },
              {
                type: "files",
                label: "Dokumenty",
                files: [
                  {
                    title: "Statut",
                    href: `/media/d/${"a".repeat(64)}.pdf`,
                    format: "pdf",
                    bytes: 9,
                  },
                  {
                    title: "Regulamin",
                    description: "Tekst jednolity.",
                    href: `/media/d/${"b".repeat(64)}.pdf`,
                    format: "pdf",
                    bytes: 9,
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toEqual({
      type: "strona",
      title: "Historia",
      href: "/szkola/historia",
      text: "Wstęp. Początki Rok 1957. Liczby 15 kierunków 1960 Nowy budynek Hala. 1970 Warsztaty Tokarki. Uwaga Archiwum. Dokumenty Statut Regulamin Tekst jednolity.",
    });
  });

  it("indexes classes with their rooms and the parents' meeting", ({ expect }) => {
    expect(
      classEntries(
        [{ grade: "Klasy czwarte", classes: [{ name: "4 Tp", room: "121" }] }],
        "9 września",
      ),
    ).toEqual([
      {
        type: "klasa",
        title: "Klasa 4 Tp",
        href: "/rodzice/wywiadowki",
        text: "Sala 121. Klasy czwarte. Zebranie z rodzicami 9 września.",
      },
    ]);
  });

  it("indexes contacts, staff groups and the bell schedule", ({ expect }) => {
    expect(
      contactEntry({
        title: "Sekretariat",
        role: "Dla uczniów",
        phones: [{ label: "12 644 06 89 wew. 103" }],
        emails: ["u@example.pl"],
      }),
    ).toEqual({
      type: "kontakt",
      title: "Sekretariat",
      href: "/kontakt",
      text: "Dla uczniów · tel. 12 644 06 89 wew. 103 · u@example.pl",
    });
    expect(
      staffEntry({
        id: "lotnictwo",
        title: "Przedmioty lotnicze",
        summary: "Nauczyciele.",
        subjects: ["awionika"],
        people: [{ role: "Nauczyciel", subjects: "silniki" }, { role: "Instruktor" }],
      }),
    ).toEqual({
      type: "kontakt",
      title: "Kadra: Przedmioty lotnicze",
      href: "/szkola/kadra#lotnictwo",
      text: "Nauczyciele. · awionika · Nauczyciel, silniki · Instruktor",
    });
    expect(
      bellsEntry([
        { number: 1, start: "8:00", end: "8:45" },
        { number: 2, start: "8:50", end: "9:35" },
      ]),
    ).toEqual({
      type: "strona",
      title: "Dzwonki: godziny lekcji i przerw",
      href: "/uczniowie/dzwonki",
      text: "Lekcja 1: 8:00–8:45 · Lekcja 2: 8:50–9:35",
    });
  });
});
