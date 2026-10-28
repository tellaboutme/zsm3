import type { ContentPage } from "@zsm3/contracts/content";

type PageSection = ContentPage["sections"][number];

export const zgloszeniaSection: PageSection = {
  id: "zgloszenia",
  title: "Informacje zwrotne i dane kontaktowe",
  blocks: [
    {
      type: "rich-text",
      document: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "W przypadku problemów z dostępnością strony internetowej prosimy o kontakt z sekretariatem szkoły: ",
            },
            {
              type: "link",
              text: "s@zespolszkolmechanicznych.edu.pl",
              href: "mailto:s@zespolszkolmechanicznych.edu.pl",
            },
            { type: "text", text: " lub telefonicznie " },
            { type: "link", text: "+48 12 644 06 89", href: "tel:+48126440689" },
            { type: "text", text: "." },
          ],
        },
        { type: "heading", level: 3, text: "Każdy ma prawo" },
        {
          type: "list",
          ordered: false,
          items: [
            [
              {
                type: "text",
                text: "Zgłosić uwagi dotyczące dostępności cyfrowej strony lub jej elementu.",
              },
            ],
            [
              {
                type: "text",
                text: "Zgłosić żądanie zapewnienia dostępności cyfrowej strony lub jej elementu.",
              },
            ],
            [
              {
                type: "text",
                text: "Wnioskować o udostępnienie niedostępnej informacji w innej alternatywnej formie.",
              },
            ],
          ],
        },
        { type: "heading", level: 3, text: "Żądanie musi zawierać" },
        {
          type: "list",
          ordered: false,
          items: [
            [{ type: "text", text: "Dane kontaktowe osoby zgłaszającej." }],
            [
              {
                type: "text",
                text: "Wskazanie strony lub elementu strony, której dotyczy żądanie.",
              },
            ],
            [
              {
                type: "text",
                text: "Wskazanie dogodnej formy udostępnienia informacji, jeśli żądanie dotyczy udostępnienia w formie alternatywnej informacji niedostępnej.",
              },
            ],
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Rozpatrzenie zgłoszenia powinno nastąpić niezwłocznie, najpóźniej w ciągu 7 dni. Jeśli w tym terminie zapewnienie dostępności albo zapewnienie dostępu w alternatywnej formie nie jest możliwe, powinno nastąpić najdalej w ciągu 2 miesięcy od daty zgłoszenia.",
            },
          ],
        },
      ],
    },
  ],
};
