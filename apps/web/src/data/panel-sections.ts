import type { PanelStaffRole } from "@zsm3/contracts/panel";

import { CONTENT_ROLES, GALLERY_ROLES, QUESTION_ROLES, REQUEST_ROLES } from "../lib/panel/gate.ts";
import type { SectionGroupId } from "../lib/panel/overview.ts";

export interface PanelSection {
  readonly href: string;
  readonly label: string;
  readonly short: string;
  readonly note: string;
  readonly group: SectionGroupId;
  readonly roles?: readonly PanelStaffRole[];
}

export const panelSections: readonly PanelSection[] = [
  {
    href: "/panel/aktualnosci",
    label: "Aktualności",
    short: "Aktualności",
    note: "Wpisy, szkice i publikacja na stronie",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/strony",
    label: "Strony",
    short: "Strony",
    note: "Treść stałych stron serwisu",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/terminarz",
    label: "Terminarz",
    short: "Terminarz",
    note: "Wydarzenia, egzaminy i dni wolne",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/dokumenty",
    label: "Dokumenty",
    short: "Dokumenty",
    note: "Pliki do pobrania",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/linki",
    label: "Krótkie linki do materiałów",
    short: "Linki",
    note: "Krótkie adresy do materiałów dla uczniów",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/ogloszenia",
    label: "Ogłoszenia",
    short: "Ogłoszenia",
    note: "Komunikat na górze każdej strony",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/zestawy",
    label: "Dane stron (kadra, kontakty, dokumenty, oferty pracy…)",
    short: "Dane stron",
    note: "Kadra, kontakty, dokumenty, oferty pracy",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/dzwonki",
    label: "Dzwonki",
    short: "Dzwonki",
    note: "Godziny lekcji i przerw",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/galeria",
    label: "Galeria",
    short: "Galeria",
    note: "Albumy i zdjęcia",
    group: "people",
    roles: GALLERY_ROLES,
  },
  {
    href: "/panel/wnioski",
    label: "Wnioski z formularza e-wniosek",
    short: "Wnioski",
    note: "Wnioski złożone przez formularz e-wniosek",
    group: "people",
    roles: REQUEST_ROLES,
  },
  {
    href: "/panel/skrzynka",
    label: "Skrzynka #OgarniamŻycie — pytania uczniów",
    short: "Skrzynka",
    note: "Pytania uczniów #OgarniamŻycie",
    group: "people",
    roles: QUESTION_ROLES,
  },
  {
    href: "/panel/pracownicy",
    label: "Pracownicy i role",
    short: "Pracownicy",
    note: "Konta pracowników i ich role",
    group: "admin",
    roles: ["admin"],
  },
  {
    href: "/panel/dziennik",
    label: "Dziennik zmian",
    short: "Dziennik",
    note: "Kto i kiedy zmienił treści",
    group: "admin",
    roles: ["admin"],
  },
  {
    href: "/panel/przekierowania",
    label: "Przekierowania",
    short: "Przekierowania",
    note: "Stare adresy prowadzące do nowych stron",
    group: "admin",
    roles: ["admin"],
  },
];
