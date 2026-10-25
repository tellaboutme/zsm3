import type { ContentPage } from "@zsm3/contracts/content";

const text = (value: string): { type: "text"; text: string } => ({ type: "text", text: value });

export const biblioteka: ContentPage = {
  path: "/szkola/biblioteka",
  kicker: "Szkoła · biblioteka",
  title: "Biblioteka szkolna",
  intro:
    "Wypożyczysz tu lektury i książki popularnonaukowe, sprawdzisz katalog online oraz swoje konto czytelnika, a także znajdziesz spokojne miejsce do nauki.",
  sections: [
    {
      id: "godziny",
      title: "Godziny pracy",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "table",
              caption: "Godziny pracy biblioteki w roku szkolnym 2026/2027",
              header: ["Dzień", "Godziny"],
              rows: [
                ["Poniedziałek", "8:30 – 15:00"],
                ["Wtorek", "8:30 – 14:00"],
                ["Środa", "8:30 – 15:00"],
                ["Czwartek", "8:30 – 13:30"],
                ["Piątek", "8:00 – 12:30"],
              ],
            },
          ],
        },
      ],
    },
    {
      id: "kontakt",
      title: "Kontakt z biblioteką",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                text("Telefon: "),
                { type: "link", text: "12 644 24 37 wew. 21", href: "tel:+48126442437" },
                text(". Poczta: "),
                {
                  type: "link",
                  text: "bibliozsm3@poczta.onet.pl",
                  href: "mailto:bibliozsm3@poczta.onet.pl",
                },
                text(". Wiadomość możesz wysłać również przez dziennik Librus."),
              ],
            },
          ],
        },
      ],
    },
    {
      id: "katalog",
      title: "Katalog online e-Biblio",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                text(
                  "Od września 2021 roku biblioteka pracuje w systemie e-Biblio w dzienniku Librus. Po zalogowaniu sprawdzisz dostępność książek, stan swojego konta, terminy zwrotu i prolongaty, a także zamówisz znalezioną publikację.",
                ),
              ],
            },
          ],
        },
      ],
    },
    {
      id: "czytaj-online",
      title: "Czytaj online",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                text("Szkolne lektury i tysiące innych książek są dostępne bezpłatnie w serwisie "),
                { type: "link", text: "Wolne Lektury", href: "https://wolnelektury.pl/" },
                text(
                  ", a polskie biblioteki cyfrowe udostępniają czasopisma, artykuły i materiały archiwalne.",
                ),
              ],
            },
          ],
        },
      ],
    },
  ],
};
