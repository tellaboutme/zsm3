import { fileLink } from "@zsm3/worker/seed/files.ts";

import type { DocumentGroup } from "../lib/documents.ts";

function form(code: string): { readonly href: string; readonly bytes: number } {
  const { href, bytes } = fileLink(`form-${code}`, code);
  return { href, bytes };
}

export const documentGroups: readonly DocumentGroup[] = [
  {
    id: "duplikaty",
    title: "Duplikaty dokumentów",
    summary: "Ponowne wydanie świadectwa lub legitymacji szkolnej.",
    documents: [
      {
        code: "W1",
        title: "Wniosek o wydanie duplikatu świadectwa",
        description: "Dla absolwenta lub ucznia, który utracił albo zniszczył świadectwo.",
        signer: "kazdy",
        ...form("w1"),
        updated: "2025-03-01",
      },
      {
        code: "W6",
        title: "Wniosek o wydanie duplikatu legitymacji",
        description: "Gdy potrzebna jest nowa legitymacja szkolna.",
        signer: "kazdy",
        ...form("w6"),
        updated: "2026-02-19",
      },
    ],
  },
  {
    id: "zwolnienia",
    title: "Zwolnienia z zajęć",
    summary: "Osobne wersje dla pełnoletniego ucznia oraz dla rodzica lub opiekuna prawnego.",
    documents: [
      {
        code: "W2",
        title: "Zwolnienie z drugiego języka obcego",
        description: "Podanie składane samodzielnie przez pełnoletniego ucznia.",
        signer: "uczen",
        ...form("w2"),
        updated: "2025-03-01",
      },
      {
        code: "W3",
        title: "Zwolnienie z wychowania fizycznego",
        description: "Podanie pełnoletniego ucznia o zwolnienie z całości lub części zajęć.",
        signer: "uczen",
        ...form("w3"),
        updated: "2025-03-01",
      },
      {
        code: "W4",
        title: "Zwolnienie z wychowania fizycznego",
        description: "Podanie rodzica lub opiekuna o zwolnienie ucznia z całości lub części zajęć.",
        signer: "rodzic",
        ...form("w4"),
        updated: "2025-03-01",
      },
      {
        code: "W5",
        title: "Zwolnienie z drugiego języka obcego",
        description: "Podanie rodzica lub opiekuna prawnego ucznia.",
        signer: "rodzic",
        ...form("w5"),
        updated: "2025-03-01",
      },
    ],
  },
  {
    id: "wydanie-dokumentow",
    title: "Wydanie dokumentów ze szkoły",
    summary: "Dokumenty związane z rezygnacją z dalszej nauki w szkole.",
    documents: [
      {
        code: "W7",
        title: "Podanie o wydanie dokumentów",
        description: "Wersja dla rodzica lub opiekuna prawnego ucznia.",
        signer: "rodzic",
        ...form("w7"),
        updated: "2025-03-01",
      },
      {
        code: "W8",
        title: "Podanie o wydanie dokumentów",
        description: "Wersja dla pełnoletniego ucznia, który składa podanie samodzielnie.",
        signer: "uczen",
        ...form("w8"),
        updated: "2025-03-01",
      },
    ],
  },
  {
    id: "zamieszkanie",
    title: "Oświadczenia dla uczniów cudzoziemskich",
    summary: "Miejsce zamieszkania ucznia w Polsce i sprawowana nad nim opieka.",
    documents: [
      {
        code: "W9",
        title: "Oświadczenie rodzica o zamieszkaniu",
        description: "Miejsce zamieszkania ucznia cudzoziemskiego na terytorium Polski.",
        signer: "rodzic",
        ...form("w9"),
        updated: "2025-03-01",
      },
      {
        code: "W10",
        title: "Oświadczenie opiekuna prawnego o zamieszkaniu",
        description: "Oświadczenie osoby sprawującej opiekę prawną nad uczniem w Polsce.",
        signer: "rodzic",
        ...form("w10"),
        updated: "2025-03-01",
      },
    ],
  },
];

export const documentSteps: readonly string[] = [
  "Wybierz formularz",
  "Otwórz plik PDF",
  "Uzupełnij i podpisz",
  "Złóż w szkole",
];
