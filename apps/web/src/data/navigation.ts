import type { Navigation } from "@zsm3/contracts/navigation";

import { externalServices } from "./site.ts";
import {
  visibleNavigation,
  type NavGroup,
  type NavLink,
  type NavSection,
} from "../lib/navigation.ts";

const candidates: NavSection = {
  id: "kandydaci",
  label: "Kandydaci",
  href: "/kandydaci",
  featured: "professions",
  groups: [
    {
      title: "Rekrutacja",
      links: [
        { label: "Rekrutacja", href: "/kandydaci/rekrutacja" },
        { label: "Dzień otwarty", href: "/kandydaci/dzien-otwarty" },
        { label: "Szkoła w obiektywie", href: "/kandydaci/szkola-w-obiektywie" },
        { label: "Wirtualny spacer", href: externalServices.virtualTour, external: true },
      ],
    },
    {
      title: "Zawody",
      links: [
        { label: "Wszystkie zawody", href: "/kandydaci/zawody" },
        { label: "Technikum", href: "/kandydaci/zawody#technikum" },
        { label: "Branżowa szkoła I stopnia", href: "/kandydaci/zawody#branzowa-1" },
        { label: "Branżowa szkoła II stopnia", href: "/kandydaci/zawody#branzowa-2" },
        { label: "Kursy zawodowe", href: "/kandydaci/kursy-zawodowe" },
      ],
    },
    {
      title: "Branże",
      links: [
        { label: "Motoryzacja", href: "/kandydaci/zawody#motoryzacja" },
        { label: "Lotnictwo", href: "/kandydaci/zawody#lotnictwo" },
        { label: "Mechatronika i robotyka", href: "/kandydaci/zawody#mechatronika" },
        { label: "Informatyka", href: "/kandydaci/zawody#informatyka" },
        { label: "Porty i terminale", href: "/kandydaci/zawody#logistyka" },
      ],
    },
  ],
};

const students: NavSection = {
  id: "uczniowie",
  label: "Uczniowie",
  href: "/uczniowie",
  featured: "live-status",
  groups: [
    {
      title: "Na co dzień",
      links: [
        { label: "Dzwonki", href: "/uczniowie/dzwonki" },
        { label: "Plan lekcji w Librusie", href: externalServices.librus, external: true },
        { label: "Materiały", href: "/uczniowie/materialy" },
        { label: "Podręczniki", href: "/uczniowie/podreczniki" },
        { label: "Plany nauczania", href: "/uczniowie/plany-nauczania" },
      ],
    },
    {
      title: "Dokumenty",
      links: [
        { label: "Wzory dokumentów", href: "/uczniowie/wzory-dokumentow" },
        { label: "E-wniosek", href: "/e-wniosek" },
        { label: "Statut", href: "/szkola/statut" },
      ],
    },
    {
      title: "Życie szkoły",
      links: [
        { label: "Wychowawcy", href: "/uczniowie/wychowawcy" },
        { label: "Samorząd", href: "/uczniowie/samorzad" },
        { label: "Koła i kluby", href: "/uczniowie/kola-i-kluby" },
        { label: "Oferty pracy", href: "/uczniowie/oferty-pracy" },
        { label: "Strefa kursów", href: "/uczniowie/strefa-kursow" },
        { label: "Bursa", href: externalServices.boardingHouse, external: true },
      ],
    },
  ],
};

const parents: NavSection = {
  id: "rodzice",
  label: "Rodzice",
  href: "/rodzice",
  featured: "next-meeting",
  groups: [
    {
      title: "Spotkania",
      links: [
        { label: "Wywiadówki", href: "/rodzice/wywiadowki" },
        { label: "Wychowawcy", href: "/uczniowie/wychowawcy" },
        { label: "Terminarz", href: "/szkola/terminarz" },
      ],
    },
    {
      title: "Szkoła i rodzice",
      links: [
        { label: "Rada Rodziców", href: "/rodzice/rada-rodzicow" },
        { label: "Kierownictwo", href: "/rodzice/kierownictwo" },
        { label: "Informacje", href: "/rodzice/informacje" },
      ],
    },
    {
      title: "Dokumenty",
      links: [
        { label: "Wzory dokumentów", href: "/uczniowie/wzory-dokumentow" },
        { label: "Statut", href: "/szkola/statut" },
        { label: "Dziennik Librus", href: externalServices.librus, external: true },
      ],
    },
  ],
};

const theSchool: NavSection = {
  id: "szkola",
  label: "Szkoła",
  href: "/szkola",
  featured: "patron",
  groups: [
    {
      title: "O szkole",
      links: [
        { label: "O szkole", href: "/szkola/o-szkole" },
        { label: "Historia", href: "/szkola/historia" },
        { label: "Patron", href: "/szkola/patron" },
        { label: "Kadra", href: "/szkola/kadra" },
        { label: "Struktura", href: "/szkola/struktura" },
      ],
    },
    {
      title: "Na co dzień",
      links: [
        { label: "Terminarz", href: "/szkola/terminarz" },
        { label: "Pomoc psychologiczna i zdrowie", href: "/szkola/pomoc" },
        { label: "Biblioteka", href: "/szkola/biblioteka" },
      ],
    },
    {
      title: "Projekty i zasady",
      links: [
        { label: "Projekty", href: "/szkola/projekty" },
        { label: "Erasmus+", href: "/szkola/projekty/erasmus" },
        { label: "Galeria", href: "/szkola/galeria" },
        { label: "Statut", href: "/szkola/statut" },
        { label: "Standardy ochrony małoletnich", href: "/szkola/standardy-ochrony-maloletnich" },
      ],
    },
  ],
};

export const sections: readonly NavSection[] = [
  candidates,
  students,
  parents,
  theSchool,
  { id: "aktualnosci", label: "Aktualności", href: "/aktualnosci", groups: [] },
  { id: "kontakt", label: "Kontakt", href: "/kontakt", groups: [] },
];

export const utilityLinks: readonly NavLink[] = [
  { label: "Librus", href: externalServices.librus, external: true },
  { label: "BIP", href: externalServices.bip, external: true },
  { label: "E-wniosek", href: "/e-wniosek" },
  { label: "Skrzynka #OgarniamŻycie", href: "/skrzynka" },
];

export const footerGroups: readonly NavGroup[] = [
  {
    title: "Na skróty",
    links: [...utilityLinks, { label: "Mapa strony", href: "/mapa-strony" }],
  },
  {
    title: "Dokumenty",
    links: [
      { label: "Statut", href: "/szkola/statut" },
      { label: "Standardy ochrony małoletnich", href: "/szkola/standardy-ochrony-maloletnich" },
      { label: "RODO", href: "/rodo" },
      { label: "Polityka prywatności", href: "/polityka-prywatnosci" },
      { label: "Deklaracja dostępności", href: "/deklaracja-dostepnosci" },
    ],
  },
  {
    title: "Informacje publiczne",
    links: [
      { label: "Biuletyn Informacji Publicznej", href: externalServices.bip, external: true },
      { label: "Zamówienia publiczne", href: "/zamowienia-publiczne" },
      { label: "Wynajem", href: "/wynajem" },
      { label: "Konkursy", href: "/konkursy" },
    ],
  },
];

export const fallbackNavigation: Navigation = {
  sections: [...sections],
  utilityLinks: [...utilityLinks],
  footerGroups: [...footerGroups],
};

export const publicFallbackNavigation = visibleNavigation(fallbackNavigation, new Set());
