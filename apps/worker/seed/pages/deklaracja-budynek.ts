import type { ContentPage } from "@zsm3/contracts/content";

type PageSection = ContentPage["sections"][number];

export const budynekSections: readonly PageSection[] = [
  {
    id: "architektura",
    title: "Dostępność architektoniczna",
    blocks: [
      {
        type: "rich-text",
        document: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Budynek Zespołu Szkół Mechanicznych nr 3 w Krakowie znajduje się na osiedlu Szkolnym 37. Główne wejście jest od strony alei Solidarności; przed wejściem jest pięć schodów.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Wejście ma dwa skrzydła: ruchome o szerokości 86 cm i drugie o szerokości 88 cm, otwierane w razie potrzeby. Drzwi nie mają automatycznego otwierania, tylko samozamykacz.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Budynek ma cztery kondygnacje: podziemie, parter, pierwsze i drugie piętro. Pierwszy i ostatni stopień wszystkich schodów oznaczono żółto-czarną taśmą. Korytarze i główna klatka schodowa są dostępne bez ograniczeń.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "W budynku szkoły nie ma windy. Szkoła może korzystać z windy Okręgowej Komisji Egzaminacyjnej w Krakowie, która mieści się w tym samym budynku, na podstawie podpisanego porozumienia.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Budynek nie ma pochylni, platform ani systemu informacji głosowej. W sekretariacie uczniowskim jest pętla indukcyjna.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Przy budynku jest parking dla pracowników z jednym miejscem dla osób z niepełnosprawnościami. Do budynku można wejść z psem asystującym.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "pjm",
    title: "Tłumacz języka migowego",
    blocks: [
      {
        type: "rich-text",
        document: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Po złożeniu wniosku można skorzystać z pomocy tłumacza polskiego języka migowego online.",
              },
            ],
          },
        ],
      },
    ],
  },
];
