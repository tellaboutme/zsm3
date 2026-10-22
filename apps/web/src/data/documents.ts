import type { DocumentGroup } from "../lib/documents.ts";

const FORMS = "https://www.zespolszkolmechanicznych.edu.pl/wp-content/uploads/2025/wzory";

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
        href: `${FORMS}/w1.pdf`,
        bytes: 550_987,
        updated: "2025-03-01",
      },
      {
        code: "W6",
        title: "Wniosek o wydanie duplikatu legitymacji",
        description: "Gdy potrzebna jest nowa legitymacja szkolna.",
        signer: "kazdy",
        href: `${FORMS}/w6.pdf`,
        bytes: 734_771,
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
        href: `${FORMS}/w2.pdf`,
        bytes: 280_544,
        updated: "2025-03-01",
      },
      {
        code: "W3",
        title: "Zwolnienie z wychowania fizycznego",
        description: "Podanie pełnoletniego ucznia o zwolnienie z całości lub części zajęć.",
        signer: "uczen",
        href: `${FORMS}/w3.pdf`,
        bytes: 283_469,
        updated: "2025-03-01",
      },
      {
        code: "W4",
        title: "Zwolnienie z wychowania fizycznego",
        description: "Podanie rodzica lub opiekuna o zwolnienie ucznia z całości lub części zajęć.",
        signer: "rodzic",
        href: `${FORMS}/w4.pdf`,
        bytes: 351_687,
        updated: "2025-03-01",
      },
      {
        code: "W5",
        title: "Zwolnienie z drugiego języka obcego",
        description: "Podanie rodzica lub opiekuna prawnego ucznia.",
        signer: "rodzic",
        href: `${FORMS}/w5.pdf`,
        bytes: 348_772,
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
        href: `${FORMS}/w7.pdf`,
        bytes: 248_635,
        updated: "2025-03-01",
      },
      {
        code: "W8",
        title: "Podanie o wydanie dokumentów",
        description: "Wersja dla pełnoletniego ucznia, który składa podanie samodzielnie.",
        signer: "uczen",
        href: `${FORMS}/w8.pdf`,
        bytes: 253_066,
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
        href: `${FORMS}/w9.pdf`,
        bytes: 397_128,
        updated: "2025-03-01",
      },
      {
        code: "W10",
        title: "Oświadczenie opiekuna prawnego o zamieszkaniu",
        description: "Oświadczenie osoby sprawującej opiekę prawną nad uczniem w Polsce.",
        signer: "rodzic",
        href: `${FORMS}/w10.pdf`,
        bytes: 61_142,
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
