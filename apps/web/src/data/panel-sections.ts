import type { PanelStaffRole } from "@zsm3/contracts/panel";

import { CONTENT_ROLES, GALLERY_ROLES, QUESTION_ROLES, REQUEST_ROLES } from "../lib/panel/gate.ts";
import type { SectionGroupId } from "../lib/panel/overview.ts";

export interface PanelSection {
  readonly href: string;
  readonly short: string;
  readonly note: string;
  readonly group: SectionGroupId;
  readonly roles?: readonly PanelStaffRole[];
}

export const panelSections: readonly PanelSection[] = [
  {
    href: "/panel/aktualnosci",
    short: "Aktualności",
    note: "Wpisy, szkice i publikacja na stronie",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/strony",
    short: "Strony",
    note: "Treść stałych stron serwisu",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/terminarz",
    short: "Terminarz",
    note: "Wydarzenia, egzaminy i dni wolne",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/dokumenty",
    short: "Dokumenty",
    note: "Pliki do pobrania",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/linki",
    short: "Linki",
    note: "Krótkie adresy do materiałów dla uczniów",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/ogloszenia",
    short: "Ogłoszenia",
    note: "Komunikat na górze każdej strony",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/zestawy",
    short: "Dane stron",
    note: "Kadra, kontakty, dokumenty, oferty pracy",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/dzwonki",
    short: "Dzwonki",
    note: "Godziny lekcji i przerw",
    group: "content",
    roles: CONTENT_ROLES,
  },
  {
    href: "/panel/galeria",
    short: "Galeria",
    note: "Albumy i zdjęcia",
    group: "content",
    roles: GALLERY_ROLES,
  },
  {
    href: "/panel/wnioski",
    short: "Wnioski",
    note: "Wnioski złożone przez formularz e-wniosek",
    group: "people",
    roles: REQUEST_ROLES,
  },
  {
    href: "/panel/skrzynka",
    short: "Skrzynka",
    note: "Pytania uczniów #OgarniamŻycie",
    group: "people",
    roles: QUESTION_ROLES,
  },
  {
    href: "/panel/pracownicy",
    short: "Pracownicy",
    note: "Konta pracowników i ich role",
    group: "admin",
    roles: ["admin"],
  },
  {
    href: "/panel/dziennik",
    short: "Dziennik",
    note: "Kto i kiedy zmienił treści",
    group: "admin",
    roles: ["admin"],
  },
  {
    href: "/panel/przekierowania",
    short: "Przekierowania",
    note: "Stare adresy prowadzące do nowych stron",
    group: "admin",
    roles: ["admin"],
  },
];
