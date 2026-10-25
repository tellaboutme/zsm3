import type { ContentPage } from "@zsm3/contracts/content";

import { fileLink } from "../files.ts";

export const rekrutacja: ContentPage = {
  path: "/kandydaci/rekrutacja",
  kicker: "Kandydaci · rekrutacja 2026/2027",
  title: "Rekrutacja",
  intro:
    "Informatory, wykaz klas, podania i wnioski dla kandydatów do technikum oraz szkół branżowych I i II stopnia, a także zasady badań lekarskich.",
  sections: [
    {
      id: "krok-po-kroku",
      title: "Krok po kroku",
      blocks: [
        {
          type: "timeline",
          items: [
            {
              label: "Krok 1",
              title: "Poznaj ofertę",
              text: "Przeczytaj informator i wykaz klas, a potem opisy zawodów w ofercie szkoły.",
            },
            {
              label: "Krok 2",
              title: "Wybierz szkołę i zawód",
              text: "Technikum trwa 5 lat, szkoła branżowa I stopnia 3 lata, a szkoła branżowa II stopnia 2 lata.",
            },
            {
              label: "Krok 3",
              title: "Złóż wniosek",
              text: "Wniosek składa się osobiście w szkole albo w systemie rekrutacji elektronicznej Omikron.",
            },
            {
              label: "Krok 4",
              title: "Wykonaj badania lekarskie",
              text: "Szkoła uczy zawodu, dlatego do wniosku dołącza się zaświadczenie z medycyny pracy. Skierowanie na badania wydaje sekretariat uczniowski.",
            },
          ],
        },
        {
          type: "callout",
          title: "Zawody i kierunki",
          text: "Program, egzaminy zawodowe i praktyki w każdym zawodzie.",
          link: { label: "Zobacz zawody", href: "/kandydaci/zawody" },
        },
      ],
    },
    {
      id: "informatory",
      title: "Informatory i wykaz klas",
      blocks: [
        {
          type: "files",
          label: "Do przeczytania",
          files: [
            fileLink(
              "recruitment-guide",
              "Informator rekrutacyjny 2026/2027",
              "Zasady rekrutacji i oferta szkoły.",
            ),
            fileLink(
              "recruitment-guide-bs2",
              "Informator dla kandydatów do Branżowej Szkoły II stopnia",
            ),
            fileLink("recruitment-classes", "Wykaz klas i zawodów 2026/2027"),
          ],
        },
      ],
    },
    {
      id: "dokumenty",
      title: "Podania i wnioski",
      blocks: [
        {
          type: "files",
          label: "Technikum i Branżowa Szkoła I stopnia",
          files: [
            fileLink("recruitment-application", "Podanie o przyjęcie do szkoły 2026/2027"),
            fileLink(
              "recruitment-form",
              "Wniosek rekrutacyjny",
              "Wniosek wraz z wymaganymi zgodami i klauzulą informacyjną.",
            ),
          ],
        },
        {
          type: "files",
          label: "Branżowa Szkoła II stopnia",
          files: [
            fileLink("recruitment-form-bs2", "Wniosek do Branżowej Szkoły II stopnia nr 9"),
            fileLink("recruitment-application-bs2", "Podanie do Branżowej Szkoły II stopnia"),
          ],
        },
      ],
    },
    {
      id: "badania",
      title: "Badania i zgody",
      blocks: [
        {
          type: "files",
          label: "Informacje dla kandydatów i rodziców",
          files: [
            fileLink(
              "recruitment-medical-1",
              "Skierowania na badania lekarskie",
              "Jak i kiedy odebrać skierowanie w sekretariacie uczniowskim.",
            ),
            fileLink(
              "recruitment-medical-2",
              "Zasady wykonywania badań lekarskich do rekrutacji",
              "Terminy dostarczenia zaświadczenia lekarskiego.",
            ),
            fileLink("recruitment-image-consent", "Zgoda na wykorzystanie wizerunku"),
          ],
        },
      ],
    },
  ],
};
