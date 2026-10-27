import { optional, text, type DatasetForm } from "./dataset-fields.ts";
import type { FieldSpec } from "./forms.ts";

const topics = (name: string, label: string, itemLabel: string): FieldSpec => ({
  kind: "list",
  name,
  label,
  itemLabel,
  fields: [
    text("title", "Tytuł", 120),
    { kind: "text", name: "text", label: "Opis", max: 400, multiline: true },
  ],
});

const schools: FieldSpec = {
  kind: "select",
  name: "school",
  label: "Szkoła",
  options: [
    { value: "technikum", label: "Technikum" },
    { value: "branzowa-1", label: "Branżowa szkoła I stopnia" },
    { value: "branzowa-2", label: "Branżowa szkoła II stopnia" },
  ],
};

const qualification: readonly FieldSpec[] = [text("code", "Kod", 12), text("name", "Nazwa", 160)];

const professions: FieldSpec = {
  kind: "list",
  name: "professions",
  label: "Zawody",
  itemLabel: "Zawód",
  fields: [
    {
      kind: "text",
      name: "slug",
      label: "Identyfikator zawodu",
      max: 80,
      hint: "małe litery i myślniki",
    },
    text("name", "Nazwa zawodu", 120),
    {
      kind: "select",
      name: "field",
      label: "Branża",
      options: [
        { value: "informatyka", label: "Informatyka" },
        { value: "mechatronika", label: "Mechatronika i robotyka" },
        { value: "motoryzacja", label: "Motoryzacja" },
        { value: "lotnictwo", label: "Lotnictwo" },
        { value: "logistyka", label: "Porty i terminale" },
      ],
    },
    { kind: "lines", name: "topics", label: "Hasła na kafelku", hint: "jedno w wierszu" },
    {
      kind: "list",
      name: "qualifications",
      label: "Kwalifikacje",
      itemLabel: "Kwalifikacja",
      fields: qualification,
    },
    {
      kind: "list",
      name: "paths",
      label: "Gdzie można się uczyć",
      itemLabel: "Ścieżka",
      fields: [schools, { kind: "number", name: "years", label: "Lata nauki", min: 1, max: 6 }],
    },
  ],
};

const programmes: FieldSpec = {
  kind: "list",
  name: "programmes",
  label: "Kierunki",
  itemLabel: "Kierunek",
  fields: [
    {
      kind: "text",
      name: "slug",
      label: "Adres strony kierunku",
      max: 80,
      hint: "część po /kandydaci/zawody/",
    },
    {
      kind: "text",
      name: "profession",
      label: "Identyfikator zawodu",
      max: 80,
      hint: "jak w liście zawodów",
    },
    schools,
    { kind: "text", name: "lead", label: "Wprowadzenie", max: 400, multiline: true },
    topics("learn", "Czego się uczysz", "Temat"),
    { kind: "lines", name: "tools", label: "Technologie i sprzęt", hint: "jedno w wierszu" },
    { kind: "lines", name: "practice", label: "Gdzie się uczysz zawodu", hint: "jedno w wierszu" },
    {
      kind: "list",
      name: "exams",
      label: "Egzaminy",
      itemLabel: "Egzamin",
      fields: [
        ...qualification,
        { kind: "text", name: "scope", label: "Zakres", max: 300, multiline: true },
        {
          kind: "object",
          name: "alternative",
          label: "Kwalifikacja zamienna (opcjonalnie)",
          optional: true,
          fields: qualification,
        },
      ],
    },
    topics("careers", "Gdzie pracujesz", "Miejsce pracy"),
    optional("entry", "Warunek przyjęcia (opcjonalnie)", 400),
    {
      kind: "select",
      name: "drivingLicence",
      label: "Kurs prawa jazdy",
      optional: true,
      options: [
        { value: "A", label: "Kategoria A" },
        { value: "B", label: "Kategoria B" },
      ],
    },
    { kind: "checkbox", name: "erasmus", label: "Praktyki Erasmus+" },
  ],
};

export const PROGRAMME_FORMS: readonly DatasetForm[] = [
  {
    key: "kierunki",
    title: "Zawody i kierunki",
    intro:
      "Kafelki zawodów i strony kierunków w sekcji Kandydaci. Adres kierunku zmieniaj ostrożnie: stare linki przestaną działać.",
    page: "/kandydaci/zawody",
    root: {
      kind: "object",
      name: "kierunki",
      label: "Zawody i kierunki",
      fields: [professions, programmes],
    },
  },
];
