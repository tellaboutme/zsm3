import type { ContentPage } from "@zsm3/contracts/content";

const paragraph = (
  value: string,
): { type: "paragraph"; content: [{ type: "text"; text: string }] } => ({
  type: "paragraph",
  content: [{ type: "text", text: value }],
});

export const samorzad: ContentPage = {
  path: "/uczniowie/samorzad",
  kicker: "Uczniowie · samorząd",
  title: "Samorząd Uczniowski",
  intro:
    "Samorząd reprezentuje wszystkich uczniów ZSM3, przedstawia dyrekcji ich opinie i wnioski oraz współorganizuje życie szkoły.",
  sections: [
    {
      id: "zadania",
      title: "Czym zajmuje się samorząd",
      blocks: [
        {
          type: "rich-text",
          document: [
            paragraph("Do zadań Samorządu Uczniowskiego należą przede wszystkim:"),
            {
              type: "list",
              ordered: false,
              items: [
                [
                  {
                    type: "text",
                    text: "przedstawianie potrzeb i opinii uczniów dyrekcji, nauczycielom i opiekunowi samorządu",
                  },
                ],
                [
                  {
                    type: "text",
                    text: "współorganizowanie uroczystości, wydarzeń i inicjatyw szkolnych",
                  },
                ],
                [{ type: "text", text: "wspieranie klas pierwszych w poznawaniu szkoły" }],
                [
                  {
                    type: "text",
                    text: "tworzenie przestrzeni dla uczniowskich pomysłów i zainteresowań",
                  },
                ],
                [{ type: "text", text: "udział w rozwiązywaniu trudnych sytuacji i konfliktów" }],
              ],
            },
          ],
        },
      ],
    },
    {
      id: "uprawnienia",
      title: "Prawa samorządu",
      blocks: [
        {
          type: "rich-text",
          document: [
            paragraph(
              "Statut szkoły daje samorządowi prawo przedstawiania dyrekcji i Radzie Pedagogicznej wniosków oraz opinii we wszystkich sprawach szkoły, współorganizowania działalności kulturalnej, oświatowej, sportowej i rozrywkowej, prowadzenia wolontariatu w porozumieniu z dyrektorem, a także wyboru nauczyciela pełniącego funkcję opiekuna samorządu.",
            ),
          ],
        },
        {
          type: "callout",
          title: "Masz pomysł na wydarzenie albo zmianę w szkole?",
          text: "Przekaż go przedstawicielom samorządu lub jego opiekunowi. Skład samorządu na bieżący rok szkolny podaje sekretariat uczniowski.",
          link: { label: "Kontakt", href: "/kontakt" },
        },
      ],
    },
  ],
};
