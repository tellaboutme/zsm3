export const FILE = `/media/d/${"a".repeat(64)}.pdf`;

export const STAFF = [
  {
    id: "informatyka",
    title: "Informatyka",
    summary: "Przedmioty informatyczne.",
    subjects: ["informatyka"],
    people: [{ name: "Jan Kowalski", role: "Nauczyciel", subjects: "sieci" }, { role: "Pedagog" }],
  },
];

export const MEETINGS = {
  date: "2026-11-18",
  order: "Zarządzenie nr 1",
  steps: [{ time: "17:00", text: "Spotkanie w auli." }],
  grades: [{ grade: "Klasy pierwsze", classes: [{ name: "1 Ta", room: "118" }] }],
};

export const CONTACTS = {
  departments: [
    {
      title: "Sekretariat",
      role: "Sprawy ogólne",
      phones: [{ number: "+48126440689,104", label: "12 644 06 89 wew. 104" }],
      emails: ["s@zsm3.pl"],
    },
  ],
  management: [
    {
      title: "Dyrektor",
      role: "Kierownictwo",
      phones: [{ number: "+48126442437", label: "12 644 24 37" }],
      emails: [],
    },
  ],
};

export const DOCUMENTS = [
  {
    id: "duplikaty",
    title: "Duplikaty",
    summary: "Ponowne wydanie.",
    documents: [
      {
        code: "W1",
        title: "Wniosek",
        description: "Opis.",
        signer: "uczen",
        href: FILE,
        bytes: 100,
        updated: "2025-03-01",
      },
      {
        code: "W2",
        title: "Wniosek",
        description: "Opis.",
        signer: "rodzic",
        href: FILE,
        bytes: 100,
        updated: "2025-03-01",
      },
      {
        code: "W3",
        title: "Wniosek",
        description: "Opis.",
        signer: "kazdy",
        href: FILE,
        bytes: 100,
        updated: "2025-03-01",
      },
    ],
  },
];

export const PROFESSIONS = [
  "informatyka",
  "mechatronika",
  "motoryzacja",
  "lotnictwo",
  "logistyka",
].map((field) => ({
  slug: `technik-${field}`,
  name: `Technik ${field}`,
  field,
  topics: ["temat"],
  qualifications: [
    { code: "A.01", name: "Pierwsza" },
    { code: "A.02", name: "Druga" },
  ],
  paths: [
    { school: "technikum", years: 5 },
    { school: "branzowa-1", years: 3 },
    { school: "branzowa-2", years: 2 },
  ],
}));

export const PROGRAMME = {
  slug: "technik-informatyka",
  profession: "technik-informatyka",
  school: "technikum",
  lead: "Wstęp.",
  learn: [
    { title: "Sieci", text: "LAN." },
    { title: "Serwery", text: "Linux." },
  ],
  tools: ["Linux"],
  practice: ["Pracownia"],
  exams: [
    {
      code: "INF.02",
      name: "Systemy",
      scope: "Zakres.",
      alternative: { code: "INF.03", name: "WWW" },
    },
  ],
  careers: [{ title: "Serwis", text: "Praca." }],
  entry: "Absolwenci szkoły podstawowej.",
  drivingLicence: "B",
  erasmus: true,
};

export const NAVIGATION = {
  sections: [
    {
      id: "kandydaci",
      label: "Kandydaci",
      href: "/kandydaci",
      groups: [
        { title: "Zawody", links: [{ label: "Technikum", href: "/kandydaci/zawody#technikum" }] },
      ],
      featured: "professions",
    },
    { id: "kontakt", label: "Kontakt", href: "/kontakt", groups: [] },
  ],
  utilityLinks: [{ label: "Librus", href: "https://portal.librus.pl/rodzina", external: true }],
  footerGroups: [{ title: "Na skróty", links: [{ label: "Mapa strony", href: "/mapa-strony" }] }],
};
