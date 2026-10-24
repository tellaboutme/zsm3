import type { ContentPage } from "@zsm3/contracts/content";

type Block = ContentPage["sections"][number]["blocks"][number];

const text = (value: string): { type: "text"; text: string } => ({ type: "text", text: value });

const paragraph = (value: string): Block => ({
  type: "rich-text",
  document: [{ type: "paragraph", content: [text(value)] }],
});

function hours(caption: string, rows: readonly (readonly [string, string])[]): Block {
  return {
    type: "rich-text",
    document: [
      {
        type: "table",
        caption,
        header: ["Dzień", "Godziny"],
        rows: rows.map(([day, span]) => [day, span]),
      },
    ],
  };
}

export const pomoc: ContentPage = {
  path: "/szkola/pomoc",
  kicker: "Szkoła · wsparcie ucznia",
  title: "Pomoc psychologiczna i zdrowie",
  intro:
    "W szkole pracują pedagog, pedagodzy specjalni i psycholog, a o zdrowie uczniów dba gabinet pielęgniarski. Nie musisz mieć gotowego rozwiązania — czasem wystarczy rozmowa.",
  sections: [
    {
      id: "pedagog",
      title: "Pedagog szkolny",
      blocks: [
        paragraph(
          "Do pedagoga możesz zgłosić się z trudnościami w nauce, frekwencją i organizacją pracy, z konfliktami w klasie oraz ze sprawami osobistymi, które wpływają na codzienne funkcjonowanie w szkole. Z konsultacji korzystają również rodzice. Gabinet znajduje się w sali 25A.",
        ),
        hours("Godziny pracy pedagoga szkolnego w roku szkolnym 2026/2027", [
          ["Poniedziałek", "8:30 – 13:30"],
          ["Wtorek", "8:30 – 13:30"],
          ["Środa", "11:00 – 17:24"],
          ["Czwartek", "8:30 – 13:30"],
          ["Piątek", "8:30 – 13:30"],
        ]),
      ],
    },
    {
      id: "pedagog-specjalny",
      title: "Pedagodzy specjalni",
      blocks: [
        paragraph(
          "W szkole pracuje dwoje pedagogów specjalnych. Rozpoznają indywidualne potrzeby edukacyjne i rozwojowe uczniów, wspierają ich w codziennym funkcjonowaniu w szkole oraz współpracują z nauczycielami i rodzicami. Godziny dostępności obu pedagogów przypadają na popołudnia; aktualny harmonogram podaje sekretariat uczniowski.",
        ),
      ],
    },
    {
      id: "psycholog",
      title: "Psycholog szkolny",
      blocks: [
        paragraph(
          "Z psychologiem porozmawiasz o trudnościach emocjonalnych, stresie, relacjach i sprawach osobistych. Gabinet znajduje się w sali 019.",
        ),
        hours("Godziny pracy psychologa szkolnego w roku szkolnym 2026/2027", [
          ["Poniedziałek", "13:20 – 16:20"],
          ["Wtorek", "7:30 – 14:20"],
          ["Środa", "13:20 – 16:20"],
          ["Czwartek", "7:30 – 14:20"],
          ["Piątek", "7:30 – 14:15"],
        ]),
      ],
    },
    {
      id: "gabinet",
      title: "Gabinet pielęgniarski",
      blocks: [
        paragraph(
          "Jeżeli podczas zajęć poczujesz się źle, zgłoś się do gabinetu pielęgniarskiego. We wtorek gabinet otwiera się wcześniej niż w pozostałe dni.",
        ),
        hours("Godziny pracy gabinetu pielęgniarskiego", [
          ["Poniedziałek", "8:30 – 16:00"],
          ["Wtorek", "7:30 – 15:00"],
          ["Środa", "8:30 – 16:00"],
          ["Czwartek", "8:30 – 16:00"],
          ["Piątek", "8:30 – 16:00"],
        ]),
      ],
    },
    {
      id: "stomatolog",
      title: "Opieka stomatologiczna",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                text(
                  "Opiekę stomatologiczną nad uczniami ZSM3 sprawuje Poradnia Stomatologiczna Centrum Medycznego Ujastek, ul. Ujastek 3 w Krakowie. Wizytę trzeba umówić wcześniej, telefonicznie: ",
                ),
                { type: "link", text: "12 293 09 32", href: "tel:+48122930932" },
                text("."),
              ],
            },
          ],
        },
      ],
    },
  ],
};
