import { id, optional, text, type DatasetForm } from "./dataset-fields.ts";

export const SITE_FORMS: readonly DatasetForm[] = [
  {
    key: "dokumenty",
    title: "Wzory dokumentów",
    intro: "Formularze na stronie Wzory dokumentów. Plik najpierw prześlij w sekcji Dokumenty.",
    page: "/uczniowie/wzory-dokumentow",
    root: {
      kind: "list",
      name: "groups",
      label: "Grupy",
      itemLabel: "Grupa",
      fields: [
        id("Identyfikator grupy"),
        text("title", "Nazwa grupy", 120),
        text("summary", "Opis", 300),
        {
          kind: "list",
          name: "documents",
          label: "Formularze",
          itemLabel: "Formularz",
          fields: [
            text("code", "Kod", 12),
            text("title", "Tytuł", 200),
            { kind: "text", name: "description", label: "Opis", max: 400, multiline: true },
            {
              kind: "select",
              name: "signer",
              label: "Kto składa",
              options: [
                { value: "kazdy", label: "Uczeń lub absolwent" },
                { value: "uczen", label: "Pełnoletni uczeń" },
                { value: "rodzic", label: "Rodzic lub opiekun prawny" },
              ],
            },
            { kind: "file", name: "file", label: "Plik", inline: true },
            { kind: "date", name: "updated", label: "Data wersji" },
          ],
        },
      ],
    },
  },
  {
    key: "partnerzy",
    title: "Partnerzy",
    intro: "Pasek partnerów i projektów na stronie głównej.",
    page: "/",
    root: {
      kind: "list",
      name: "partners",
      label: "Partnerzy",
      itemLabel: "Partner",
      fields: [
        text("name", "Nazwa", 120),
        text("role", "Rola", 200),
        optional("href", "Adres strony (opcjonalnie, od „/” albo „https://”)", 500),
      ],
    },
  },
  {
    key: "oferty-pracy",
    title: "Oferty pracy",
    intro: "Oferty na stronie Oferty pracy. Po terminie ważności oferta sama trafia do archiwum.",
    page: "/uczniowie/oferty-pracy",
    root: {
      kind: "list",
      name: "offers",
      label: "Oferty",
      itemLabel: "Oferta",
      fields: [
        text("employer", "Pracodawca", 160),
        text("position", "Stanowisko", 160),
        {
          kind: "text",
          name: "description",
          label: "Opis (opcjonalnie)",
          max: 600,
          optional: true,
          multiline: true,
        },
        { kind: "date", name: "validUntil", label: "Ważna do" },
        { kind: "file", name: "file", label: "Plik PDF (opcjonalnie)", optional: true },
      ],
    },
  },
];
