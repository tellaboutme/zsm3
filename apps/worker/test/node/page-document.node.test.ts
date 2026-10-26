import type { ContentPage } from "@zsm3/contracts/content";
import { it } from "vitest";

import { pageDocument } from "../../src/storage/pages-repo.ts";

it("preserves boundaries and metadata of each content block", ({ expect }) => {
  const page: ContentPage = {
    path: "/szkola/warsztaty",
    kicker: "Sekcja",
    title: "Warsztaty",
    intro: "Wstęp o warsztatach.",
    sections: [
      {
        id: "odznaki",
        title: "Odznaki i legitymacje",
        blocks: [
          { type: "facts", label: "Oferta", facts: [{ value: "Łódź", label: "miasto" }] },
          {
            type: "timeline",
            items: [{ label: "2026", title: "Samoloty", text: "Pokazy lotnicze" }],
          },
          { type: "callout", title: "Zapisy", text: "Zapisz klasę 4 Tp" },
          {
            type: "files",
            label: "Druki",
            files: [
              {
                title: "Wniosek o legitymację",
                href: `/media/d/${"a".repeat(64)}.pdf`,
                format: "pdf",
                bytes: 10,
              },
              {
                title: "Karta zgłoszenia",
                description: "Dla kandydatów",
                href: `/media/d/${"b".repeat(64)}.pdf`,
                format: "pdf",
                bytes: 20,
              },
            ],
          },
        ],
      },
    ],
  };

  expect(pageDocument(page)).toEqual({
    docId: "p:/szkola/warsztaty",
    kind: "strona",
    href: "/szkola/warsztaty",
    title: "Warsztaty",
    body: "Wstęp o warsztatach. Odznaki i legitymacje Oferta Łódź miasto 2026 Samoloty Pokazy lotnicze Zapisy Zapisz klasę 4 Tp Druki Wniosek o legitymację Karta zgłoszenia Dla kandydatów",
    publishedOn: null,
  });
});
