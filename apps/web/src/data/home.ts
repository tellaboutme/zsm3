import { externalServices } from "./site.ts";
import type { NavGroup, NavLink } from "../lib/navigation.ts";

export interface Partner {
  readonly name: string;
  readonly role: string;
  readonly href?: string;
}

export const quickLinks: readonly NavLink[] = [
  { label: "Dzwonki", href: "/uczniowie/dzwonki" },
  { label: "Wzory dokumentów", href: "/uczniowie/wzory-dokumentow" },
  { label: "Wywiadówki", href: "/rodzice/wywiadowki" },
  { label: "Kontakt", href: "/kontakt" },
];

export const audiencePanels: readonly NavGroup[] = [
  {
    title: "Dla kandydata",
    links: [
      { label: "Rekrutacja", href: "/kandydaci/rekrutacja" },
      { label: "Wszystkie zawody", href: "/kandydaci/zawody" },
      { label: "Dzień otwarty", href: "/kandydaci/dzien-otwarty" },
      { label: "Wirtualny spacer", href: externalServices.virtualTour, external: true },
    ],
  },
  {
    title: "Dla ucznia",
    links: [
      { label: "Dzwonki", href: "/uczniowie/dzwonki" },
      { label: "Plan lekcji w Librusie", href: externalServices.librus, external: true },
      { label: "E-wniosek", href: "/e-wniosek" },
      { label: "Wzory dokumentów", href: "/uczniowie/wzory-dokumentow" },
    ],
  },
  {
    title: "Dla rodzica",
    links: [
      { label: "Wywiadówki", href: "/rodzice/wywiadowki" },
      { label: "Dziennik Librus", href: externalServices.librus, external: true },
      { label: "Wychowawcy", href: "/uczniowie/wychowawcy" },
      { label: "Rada Rodziców", href: "/rodzice/rada-rodzicow" },
    ],
  },
];

export const partners: readonly Partner[] = [
  {
    name: "Erasmus+",
    role: "wyjazdy i praktyki zagraniczne uczniów od 2014 roku",
  },
  {
    name: "Centrum Kompetencji Zawodowych",
    role: "kursy zawodowe dla uczniów w projekcie współfinansowanym przez Unię Europejską",
  },
  { name: "LS Airport Services", role: "partner kierunków lotniczych" },
];
