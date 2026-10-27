import { text, type DatasetForm } from "./dataset-fields.ts";
import type { FieldSpec } from "./forms.ts";

const links = (name: string, label: string): FieldSpec => ({
  kind: "list",
  name,
  label,
  itemLabel: "Link",
  fields: [
    text("label", "Tekst linku", 120),
    { kind: "text", name: "href", label: "Adres", max: 500, hint: "od „/” albo „https://”" },
    { kind: "checkbox", name: "external", label: "Zewnętrzna strona", omitFalse: true },
  ],
});

const groups = (name: string, label: string): FieldSpec => ({
  kind: "list",
  name,
  label,
  itemLabel: "Grupa",
  fields: [text("title", "Tytuł grupy", 120), links("links", "Linki")],
});

export const NAVIGATION_FORMS: readonly DatasetForm[] = [
  {
    key: "nawigacja",
    title: "Menu i stopka",
    intro: "Menu w nagłówku, menu na telefonie, linki pomocnicze i grupy linków w stopce.",
    page: "/",
    root: {
      kind: "object",
      name: "navigation",
      label: "Nawigacja",
      fields: [
        {
          kind: "list",
          name: "sections",
          label: "Sekcje menu",
          itemLabel: "Sekcja",
          fields: [
            { kind: "text", name: "id", label: "Identyfikator", max: 40 },
            text("label", "Nazwa w menu", 40),
            { kind: "text", name: "href", label: "Adres sekcji", max: 300 },
            groups("groups", "Kolumny menu"),
            {
              kind: "select",
              name: "featured",
              label: "Wyróżniony moduł w menu",
              optional: true,
              options: [
                { value: "professions", label: "Zawody" },
                { value: "live-status", label: "Teraz w szkole" },
                { value: "next-meeting", label: "Najbliższe zebranie" },
                { value: "patron", label: "Patron" },
              ],
            },
          ],
        },
        links("utilityLinks", "Linki pomocnicze"),
        groups("footerGroups", "Stopka"),
      ],
    },
  },
];
