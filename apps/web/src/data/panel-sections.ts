export interface PanelSection {
  readonly href: string;
  readonly label: string;
  readonly short: string;
  readonly admin?: true;
}

export const panelSections: readonly PanelSection[] = [
  { href: "/panel/aktualnosci", label: "Aktualności", short: "Aktualności" },
  { href: "/panel/strony", label: "Strony", short: "Strony" },
  { href: "/panel/terminarz", label: "Terminarz", short: "Terminarz" },
  { href: "/panel/dokumenty", label: "Dokumenty", short: "Dokumenty" },
  { href: "/panel/ogloszenia", label: "Ogłoszenia", short: "Ogłoszenia" },
  {
    href: "/panel/zestawy",
    label: "Dane stron (kadra, kontakty, dokumenty, oferty pracy…)",
    short: "Dane stron",
  },
  { href: "/panel/dzwonki", label: "Dzwonki", short: "Dzwonki" },
  { href: "/panel/pracownicy", label: "Pracownicy i role", short: "Pracownicy", admin: true },
  { href: "/panel/dziennik", label: "Dziennik zmian", short: "Dziennik", admin: true },
  { href: "/panel/przekierowania", label: "Przekierowania", short: "Przekierowania", admin: true },
];
