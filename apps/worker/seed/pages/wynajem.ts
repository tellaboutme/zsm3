import type { ContentPage } from "@zsm3/contracts/content";

import { fileLink } from "../files.ts";

export const wynajem: ContentPage = {
  path: "/wynajem",
  kicker: "Informacje publiczne",
  title: "Wynajem pomieszczeń",
  intro:
    "Szkoła wynajmuje sale, pracownie i obiekty sportowe. Poniżej wykaz wynajmowanych pomieszczeń oraz zarządzenie w sprawie stawek.",
  sections: [
    {
      id: "dokumenty",
      title: "Dokumenty",
      blocks: [
        {
          type: "files",
          label: "Do pobrania",
          files: [
            fileLink("rent-list", "Wykaz wynajmowanych pomieszczeń"),
            fileLink("rent-rates", "Zarządzenie w sprawie stawek najmu"),
          ],
        },
        {
          type: "callout",
          title: "Rezerwacja i pytania",
          text: "W sprawie wynajmu skontaktuj się z sekretariatem szkoły.",
          link: { label: "Kontakt", href: "/kontakt" },
        },
      ],
    },
  ],
};
