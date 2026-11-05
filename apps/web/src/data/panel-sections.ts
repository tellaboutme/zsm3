import type { PanelStaffRole } from "@zsm3/contracts/panel";

import { CONTENT_ROLES, GALLERY_ROLES, REQUEST_ROLES } from "../lib/panel/gate.ts";

export interface PanelSection {
  readonly href: string;
  readonly label: string;
  readonly short: string;
  readonly roles?: readonly PanelStaffRole[];
}

export const panelSections: readonly PanelSection[] = [
  { href: "/panel/aktualnosci", label: "Aktualności", short: "Aktualności", roles: CONTENT_ROLES },
  { href: "/panel/strony", label: "Strony", short: "Strony", roles: CONTENT_ROLES },
  { href: "/panel/terminarz", label: "Terminarz", short: "Terminarz", roles: CONTENT_ROLES },
  { href: "/panel/dokumenty", label: "Dokumenty", short: "Dokumenty", roles: CONTENT_ROLES },
  {
    href: "/panel/linki",
    label: "Krótkie linki do materiałów",
    short: "Linki",
    roles: CONTENT_ROLES,
  },
  { href: "/panel/ogloszenia", label: "Ogłoszenia", short: "Ogłoszenia", roles: CONTENT_ROLES },
  {
    href: "/panel/zestawy",
    label: "Dane stron (kadra, kontakty, dokumenty, oferty pracy…)",
    short: "Dane stron",
    roles: CONTENT_ROLES,
  },
  { href: "/panel/dzwonki", label: "Dzwonki", short: "Dzwonki", roles: CONTENT_ROLES },
  { href: "/panel/galeria", label: "Galeria", short: "Galeria", roles: GALLERY_ROLES },
  {
    href: "/panel/wnioski",
    label: "Wnioski z formularza e-wniosek",
    short: "Wnioski",
    roles: REQUEST_ROLES,
  },
  { href: "/panel/pracownicy", label: "Pracownicy i role", short: "Pracownicy", roles: ["admin"] },
  { href: "/panel/dziennik", label: "Dziennik zmian", short: "Dziennik", roles: ["admin"] },
  {
    href: "/panel/przekierowania",
    label: "Przekierowania",
    short: "Przekierowania",
    roles: ["admin"],
  },
];
