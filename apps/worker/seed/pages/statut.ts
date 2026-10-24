import type { ContentPage } from "@zsm3/contracts/content";

import { fileLink } from "../files.ts";

export const statut: ContentPage = {
  path: "/szkola/statut",
  kicker: "Szkoła · dokumenty",
  title: "Statuty",
  intro:
    "Statuty określają organizację szkoły, zasady jej funkcjonowania oraz prawa i obowiązki uczniów, rodziców i nauczycieli.",
  sections: [
    {
      id: "statuty",
      title: "Obowiązujące statuty",
      blocks: [
        {
          type: "files",
          label: "Dokumenty do pobrania",
          files: [
            fileLink(
              "statute-zsm3",
              "Statut Zespołu Szkół Mechanicznych nr 3",
              "Technikum Mechaniczne nr 17 i Branżowa Szkoła I stopnia nr 17.",
            ),
            fileLink(
              "statute-bs2",
              "Statut Branżowej Szkoły II stopnia nr 9",
              "Szkoła w Zespole Szkół Mechanicznych nr 3.",
            ),
          ],
        },
      ],
    },
  ],
};
