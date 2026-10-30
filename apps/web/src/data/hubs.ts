import type { NavLink } from "../lib/navigation.ts";

export interface Hub {
  readonly section: string;
  readonly intro: string;
  readonly action: NavLink;
}

export const hubs: readonly Hub[] = [
  {
    section: "kandydaci",
    intro: "Zawody w technikum i szkole branżowej, zasady rekrutacji i wirtualny spacer po szkole.",
    action: { label: "Rekrutacja", href: "/kandydaci/rekrutacja" },
  },
  {
    section: "uczniowie",
    intro: "Dzwonki, dokumenty, e-wniosek i wszystko, czego potrzebujesz na co dzień w szkole.",
    action: { label: "E-wniosek", href: "/e-wniosek" },
  },
  {
    section: "rodzice",
    intro: "Terminy zebrań, Rada Rodziców i dokumenty szkoły w jednym miejscu.",
    action: { label: "Wywiadówki", href: "/rodzice/wywiadowki" },
  },
  {
    section: "szkola",
    intro:
      "Historia, patron, kadra, terminarz roku szkolnego i projekty Zespołu Szkół Mechanicznych nr 3.",
    action: { label: "Terminarz", href: "/szkola/terminarz" },
  },
];
