import type { ContentPage } from "@zsm3/contracts/content";

const paragraph = (
  text: string,
): { type: "paragraph"; content: [{ type: "text"; text: string }] } => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

export const struktura: ContentPage = {
  path: "/szkola/struktura",
  kicker: "Szkoła · organizacja",
  title: "Struktura szkoły",
  intro:
    "Zespół Szkół Mechanicznych nr 3 im. gen. Władysława Sikorskiego tworzą trzy szkoły ze wspólnym kierownictwem, kadrą i budynkiem przy os. Szkolnym 37.",
  sections: [
    {
      id: "szkoly",
      title: "Trzy szkoły w zespole",
      blocks: [
        {
          type: "facts",
          label: "Szkoły w zespole",
          facts: [
            { value: "TM17", label: "Technikum Mechaniczne nr 17, nauka 5 lat" },
            { value: "BS1", label: "Branżowa Szkoła I stopnia nr 17, nauka 3 lata" },
            { value: "BS2", label: "Branżowa Szkoła II stopnia nr 9, nauka 2 lata" },
          ],
        },
        {
          type: "rich-text",
          document: [
            paragraph(
              "Technikum kształci w zawodach informatycznych, mechatronicznych, motoryzacyjnych, lotniczych i portowych. Szkoła branżowa I stopnia przygotowuje do pracy w zawodach samochodowych, a szkoła branżowa II stopnia pozwala jej absolwentom zdobyć wykształcenie średnie branżowe i tytuł technika.",
            ),
          ],
        },
        {
          type: "callout",
          title: "Kierunki kształcenia",
          text: "Opis każdego zawodu, egzaminów i praktyk znajdziesz w ofercie szkoły.",
          link: { label: "Zawody i kierunki", href: "/kandydaci/zawody" },
        },
      ],
    },
    {
      id: "organy",
      title: "Organy szkoły",
      blocks: [
        {
          type: "rich-text",
          document: [
            paragraph("Zgodnie ze statutem zespołu w szkole działają cztery organy:"),
            {
              type: "list",
              ordered: false,
              items: [
                [
                  {
                    type: "text",
                    text: "Dyrektor szkoły, który kieruje zespołem i reprezentuje go na zewnątrz.",
                  },
                ],
                [{ type: "text", text: "Rada Pedagogiczna, którą tworzą wszyscy nauczyciele." }],
                [{ type: "text", text: "Rada Rodziców, reprezentująca rodziców uczniów." }],
                [{ type: "text", text: "Samorząd Uczniowski, reprezentujący wszystkich uczniów." }],
              ],
            },
          ],
        },
      ],
    },
    {
      id: "kierownictwo",
      title: "Kierownictwo i zespół",
      blocks: [
        {
          type: "rich-text",
          document: [
            paragraph(
              "Pracą zespołu kieruje dyrektor wraz z dwoma wicedyrektorami i kierownikiem szkolenia praktycznego, który odpowiada za praktyki i zajęcia w pracowniach. Uczniów na co dzień wspierają pedagog szkolny, psycholog i pedagodzy specjalni, a sprawy administracyjne prowadzą sekretariaty i księgowość.",
            ),
          ],
        },
        {
          type: "callout",
          title: "Kadra szkoły",
          text: "Lista funkcji i przedmiotów prowadzonych przez nauczycieli.",
          link: { label: "Kadra", href: "/szkola/kadra" },
        },
      ],
    },
  ],
};
