import type { ContentPage } from "@zsm3/contracts/content";

const text = (value: string): { type: "text"; text: string } => ({ type: "text", text: value });

export const radaRodzicow: ContentPage = {
  path: "/rodzice/rada-rodzicow",
  kicker: "Rodzice · Rada Rodziców",
  title: "Rada Rodziców",
  intro:
    "Rada Rodziców reprezentuje rodziców uczniów ZSM3, opiniuje sprawy szkoły i finansuje część szkolnych przedsięwzięć ze składek.",
  sections: [
    {
      id: "kontakt",
      title: "Kontakt",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                text("Napisz na adres "),
                { type: "link", text: "rodzice.zsm3@wp.pl", href: "mailto:rodzice.zsm3@wp.pl" },
                text(
                  " albo zostaw wiadomość w sekretariacie szkoły, os. Szkolne 37, 31-978 Kraków.",
                ),
              ],
            },
          ],
        },
      ],
    },
    {
      id: "skladki",
      title: "Rachunek bankowy",
      blocks: [
        {
          type: "facts",
          label: "Wpłaty na Radę Rodziców",
          facts: [
            { value: "84 1020 2906 0000 1902 0013 5491", label: "numer rachunku" },
            {
              value: "Rada Rodziców ZSM nr 3",
              label: "odbiorca: Rada Rodziców Zespołu Szkół Mechanicznych nr 3 w Krakowie",
            },
          ],
        },
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                text(
                  "W tytule przelewu wpisz imię i nazwisko ucznia oraz klasę. Skład prezydium na bieżący rok szkolny podaje sekretariat szkoły.",
                ),
              ],
            },
          ],
        },
      ],
    },
    {
      id: "przydatne",
      title: "Przydatne dla rodziców",
      blocks: [
        {
          type: "callout",
          title: "Wywiadówki",
          text: "Terminy zebrań z rodzicami i sale, w których odbywają się spotkania.",
          link: { label: "Wywiadówki", href: "/rodzice/wywiadowki" },
        },
        {
          type: "callout",
          title: "Wzory dokumentów",
          text: "Podania, wnioski i oświadczenia składane przez rodziców i uczniów.",
          link: { label: "Wzory dokumentów", href: "/uczniowie/wzory-dokumentow" },
        },
      ],
    },
  ],
};
