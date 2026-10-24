import type { ContentPage } from "@zsm3/contracts/content";

import { fileLink } from "../files.ts";

interface PlanGroup {
  readonly id: string;
  readonly title: string;
  readonly plans: readonly (readonly [number, string])[];
}

const technikum: readonly PlanGroup[] = [
  {
    id: "technik-mechatronik",
    title: "Technik mechatronik",
    plans: [
      [1, "1 Ta, 2 Ta"],
      [2, "3 Ta"],
      [3, "4 Ta"],
      [4, "5 Ta"],
    ],
  },
  {
    id: "technik-pojazdow-samochodowych",
    title: "Technik pojazdów samochodowych",
    plans: [
      [5, "1 Tb, 1 Td, 2 Tb, 2 Td"],
      [6, "3 Tb, 3 Td"],
      [7, "4 Tb, 4 Td"],
      [8, "5 Tb, 5 Td"],
    ],
  },
  {
    id: "technik-informatyk",
    title: "Technik informatyk",
    plans: [
      [9, "1 Tc, 2 Tc"],
      [10, "4 Tc"],
      [11, "5 Tc, 5 Te"],
    ],
  },
  {
    id: "technik-programista",
    title: "Technik programista",
    plans: [
      [12, "1 Tp, 2 Tp"],
      [13, "3 Tp"],
      [14, "4 Tp"],
      [15, "5 Tp"],
    ],
  },
  {
    id: "technik-lotniskowych-sluzb-operacyjnych",
    title: "Technik lotniskowych służb operacyjnych",
    plans: [
      [16, "1 Ts"],
      [17, "2 Ts"],
      [18, "3 Ts"],
      [19, "4 Ts"],
      [20, "5 Ts"],
    ],
  },
  {
    id: "technik-mechanik-lotniczy",
    title: "Technik mechanik lotniczy",
    plans: [
      [21, "1 LST"],
      [22, "2 Tm"],
      [23, "3 Tm"],
      [24, "4 Tm"],
      [25, "5 Tm"],
    ],
  },
];

const branzowa: readonly PlanGroup[] = [
  {
    id: "mechanik-pojazdow-samochodowych",
    title: "Mechanik pojazdów samochodowych",
    plans: [
      [26, "1 Ba, 1 Bd, 2 Ba"],
      [28, "3 Ba, 3 Bd"],
    ],
  },
  {
    id: "elektromechanik-pojazdow-samochodowych",
    title: "Elektromechanik pojazdów samochodowych",
    plans: [
      [27, "1 Bb"],
      [29, "3 Bb"],
    ],
  },
  {
    id: "branzowa-ii-stopnia",
    title: "Technik pojazdów samochodowych (Branżowa Szkoła II stopnia)",
    plans: [[30, "1 BDa, 2 BDa, 2 BDb"]],
  },
];

function plansBlock(group: PlanGroup): ContentPage["sections"][number]["blocks"][number] {
  return {
    type: "files",
    label: group.title,
    files: group.plans.map(([number, classes]) =>
      fileLink(
        `plan-${String(number).padStart(2, "0")}`,
        `Plan nr ${String(number)}: klasy ${classes}`,
      ),
    ),
  };
}

export const planyNauczania: ContentPage = {
  path: "/uczniowie/plany-nauczania",
  kicker: "Uczniowie · rok szkolny 2026/2027",
  title: "Plany nauczania",
  intro:
    "Szkolne plany nauczania na rok szkolny 2026/2027 dla technikum oraz szkół branżowych, uporządkowane według zawodów i klas.",
  sections: [
    {
      id: "zestaw",
      title: "Zestaw planów",
      blocks: [
        {
          type: "files",
          label: "Dokumenty zbiorcze",
          files: [
            fileLink(
              "plans-index",
              "Szkolny zestaw planów nauczania 2026/2027",
              "Wykaz wszystkich planów z ich numeracją.",
            ),
            fileLink("plans-all", "Wszystkie plany w jednym archiwum", "Archiwum 7z."),
          ],
        },
      ],
    },
    {
      id: "technikum",
      title: "Technikum Mechaniczne nr 17",
      blocks: technikum.map(plansBlock),
    },
    {
      id: "branzowa",
      title: "Szkoły branżowe",
      blocks: branzowa.map(plansBlock),
    },
  ],
};
