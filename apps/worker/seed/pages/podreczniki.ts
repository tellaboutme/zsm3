import type { ContentPage } from "@zsm3/contracts/content";

import { fileLink } from "../files.ts";

export const podreczniki: ContentPage = {
  path: "/uczniowie/podreczniki",
  kicker: "Uczniowie · rok szkolny 2026/2027",
  title: "Wykaz podręczników",
  intro:
    "Wykazy podręczników na rok szkolny 2026/2027 dla każdego zawodu, z tytułami, autorami i wydawnictwami dla poszczególnych klas.",
  sections: [
    {
      id: "przed-zakupem",
      title: "Przed zakupem",
      blocks: [
        {
          type: "callout",
          title: "Podręczniki do przedmiotów zawodowych kup po pierwszych zajęciach",
          text: "Nauczyciel przedmiotu poda uczniom właściwe tytuły na początku roku szkolnego.",
        },
      ],
    },
    {
      id: "technikum",
      title: "Technikum Mechaniczne nr 17",
      blocks: [
        {
          type: "files",
          label: "Wykazy dla zawodów",
          files: [
            fileLink("books-tprogramista", "Technik programista"),
            fileLink("books-tinf", "Technik informatyk"),
            fileLink("books-tmechatronik", "Technik mechatronik"),
            fileLink("books-tpojsam", "Technik pojazdów samochodowych"),
            fileLink("books-tmechlot", "Technik mechanik lotniczy"),
            fileLink("books-tlotsop", "Technik lotniskowych służb operacyjnych"),
          ],
        },
      ],
    },
    {
      id: "branzowa",
      title: "Branżowa Szkoła I stopnia nr 17",
      blocks: [
        {
          type: "files",
          label: "Wykazy dla zawodów",
          files: [
            fileLink("books-mpojsam", "Mechanik pojazdów samochodowych"),
            fileLink("books-epojsam", "Elektromechanik pojazdów samochodowych"),
          ],
        },
      ],
    },
  ],
};
