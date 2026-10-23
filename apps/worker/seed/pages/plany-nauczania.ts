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
      [1, "1Ta, 2Ta"],
      [2, "3Ta"],
      [3, "4Ta"],
      [4, "5Ta"],
    ],
  },
  {
    id: "technik-pojazdow-samochodowych",
    title: "Technik pojazdów samochodowych",
    plans: [
      [5, "1Tb, 1Td, 2Tb, 2Td"],
      [6, "3Tb, 3Td"],
      [7, "4Tb, 4Td"],
      [8, "5Tb, 5Td"],
    ],
  },
  {
    id: "technik-informatyk",
    title: "Technik informatyk",
    plans: [
      [9, "1Tc, 2Tc"],
      [10, "4Tc"],
      [11, "5Tc, 5Te"],
    ],
  },
  {
    id: "technik-programista",
    title: "Technik programista",
    plans: [
      [12, "1Tp, 2Tp"],
      [13, "3Tp"],
      [14, "4Tp"],
      [15, "5Tp"],
    ],
  },
  {
    id: "technik-lotniskowych-sluzb-operacyjnych",
    title: "Technik lotniskowych służb operacyjnych",
    plans: [
      [16, "1Ts"],
      [17, "2Ts"],
      [18, "3Ts"],
      [19, "4Ts"],
      [20, "5Ts"],
    ],
  },
  {
    id: "technik-mechanik-lotniczy",
    title: "Technik mechanik lotniczy",
    plans: [
      [21, "1LST"],
      [22, "2Tm"],
      [23, "3Tm"],
      [24, "4Tm"],
      [25, "5Tm"],
    ],
  },
];

const branzowa: readonly PlanGroup[] = [
  {
    id: "mechanik-pojazdow-samochodowych",
    title: "Mechanik pojazdów samochodowych",
    plans: [
      [26, "1Ba, 1Bd, 2Ba"],
      [28, "3Ba, 3Bd"],
    ],
  },
  {
    id: "elektromechanik-pojazdow-samochodowych",
    title: "Elektromechanik pojazdów samochodowych",
    plans: [
      [27, "1Bb"],
      [29, "3Bb"],
    ],
  },
  {
    id: "branzowa-ii-stopnia",
    title: "Technik pojazdów samochodowych (Branżowa Szkoła II stopnia)",
    plans: [[30, "1BDa, 2BDa, 2BDb"]],
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
