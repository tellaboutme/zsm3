import { contactCard, id, optional, text, type DatasetForm } from "./dataset-fields.ts";

export const PEOPLE_FORMS: readonly DatasetForm[] = [
  {
    key: "kadra",
    title: "Kadra",
    intro: "Grupy kadry na stronie Kadra. Imiona i nazwiska podaj tylko za zgodą osób.",
    page: "/szkola/kadra",
    root: {
      kind: "list",
      name: "groups",
      label: "Grupy",
      itemLabel: "Grupa",
      fields: [
        id("Identyfikator grupy"),
        text("title", "Nazwa grupy", 120),
        text("summary", "Opis", 300),
        { kind: "lines", name: "subjects", label: "Przedmioty", hint: "jeden w wierszu" },
        {
          kind: "list",
          name: "people",
          label: "Osoby",
          itemLabel: "Osoba",
          fields: [
            optional("name", "Imię i nazwisko (opcjonalnie)", 120),
            text("role", "Funkcja", 120),
            optional("subjects", "Przedmioty (opcjonalnie)", 300),
          ],
        },
      ],
    },
  },
  {
    key: "wywiadowki",
    title: "Wywiadówki",
    intro: "Najbliższe zebranie z rodzicami i sale klas na stronie Wywiadówki.",
    page: "/rodzice/wywiadowki",
    root: {
      kind: "object",
      name: "meetings",
      label: "Wywiadówki",
      fields: [
        { kind: "date", name: "date", label: "Data zebrania" },
        text("order", "Podstawa (zarządzenie)", 300),
        {
          kind: "list",
          name: "steps",
          label: "Harmonogram",
          itemLabel: "Punkt",
          fields: [{ kind: "time", name: "time", label: "Godzina" }, text("text", "Opis", 300)],
        },
        {
          kind: "list",
          name: "grades",
          label: "Roczniki",
          itemLabel: "Rocznik",
          fields: [
            text("grade", "Nazwa rocznika", 60),
            {
              kind: "list",
              name: "classes",
              label: "Klasy",
              itemLabel: "Klasa",
              fields: [text("name", "Klasa", 20), text("room", "Sala", 20)],
            },
          ],
        },
      ],
    },
  },
  {
    key: "kontakty",
    title: "Kontakty",
    intro: "Karty kontaktowe na stronie Kontakt.",
    page: "/kontakt",
    root: {
      kind: "object",
      name: "contacts",
      label: "Kontakty",
      fields: [
        {
          kind: "list",
          name: "departments",
          label: "Sekretariaty i działy",
          itemLabel: "Karta",
          fields: contactCard,
        },
        {
          kind: "list",
          name: "management",
          label: "Kierownictwo",
          itemLabel: "Karta",
          fields: contactCard,
        },
      ],
    },
  },
];
