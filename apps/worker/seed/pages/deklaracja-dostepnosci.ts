import type { ContentPage } from "@zsm3/contracts/content";

import { zgloszeniaSection } from "./deklaracja-zgloszenia.ts";

export const deklaracjaDostepnosci: ContentPage = {
  path: "/deklaracja-dostepnosci",
  kicker: "Dostępność cyfrowa · podmiot publiczny",
  title: "Deklaracja dostępności",
  intro:
    "Zespół Szkół Mechanicznych Nr 3 w Krakowie zobowiązuje się zapewnić dostępność swojej strony internetowej zgodnie z przepisami ustawy z dnia 4 kwietnia 2019 r. o dostępności cyfrowej stron internetowych i aplikacji mobilnych podmiotów publicznych.",
  sections: [
    {
      id: "daty",
      title: "Podstawowe daty",
      blocks: [
        {
          type: "facts",
          label: "Deklaracja w liczbach",
          facts: [
            { value: "2019-09-01", label: "data publikacji strony internetowej" },
            { value: "2026-03-28", label: "data ostatniej istotnej aktualizacji" },
            { value: "2021-09-01", label: "data sporządzenia deklaracji" },
            { value: "2026-03-28", label: "data ostatniego przeglądu deklaracji" },
          ],
        },
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Deklarację sporządzono na podstawie samooceny." }],
            },
          ],
        },
      ],
    },
    {
      id: "zgodnosc",
      title: "Status pod względem zgodności z ustawą",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Strona internetowa jest częściowo zgodna z ustawą o dostępności cyfrowej stron internetowych i aplikacji mobilnych podmiotów publicznych z powodu niezgodności lub wyłączeń wymienionych poniżej.",
                },
              ],
            },
            {
              type: "list",
              ordered: false,
              items: [
                [
                  {
                    type: "text",
                    text: "Dokumenty tekstowe mogą nie zawierać tagów oraz zawierać nieopisane elementy graficzne, ponieważ były opublikowane przed wejściem w życie ustawy o dostępności cyfrowej lub pochodzą ze źródeł zewnętrznych.",
                  },
                ],
                [
                  {
                    type: "text",
                    text: "Zdjęcia i grafiki osadzone w treści dokumentu mogą zawierać niepoprawne opisy, ponieważ były opublikowane przed wejściem w życie ustawy o dostępności cyfrowej.",
                  },
                ],
                [
                  {
                    type: "text",
                    text: "Tabele osadzone w treści dokumentu mogą nie posiadać nagłówków oraz opisów kolumn i wierszy, ponieważ były opublikowane przed wejściem w życie ustawy o dostępności cyfrowej.",
                  },
                ],
                [
                  {
                    type: "text",
                    text: "Elementy osadzone pochodzące od zewnętrznych dostawców, na przykład Google Maps, wyłączone są z obowiązku zapewniania dostępności.",
                  },
                ],
              ],
            },
          ],
        },
      ],
    },
    zgloszeniaSection,
    {
      id: "skargi",
      title: "Skargi i odwołania",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Na niedotrzymanie tych terminów oraz na odmowę realizacji żądania można złożyć skargę z zastosowaniem przepisów ustawy z dnia 14 czerwca 1960 r. Kodeks postępowania administracyjnego, a także powiadomić ",
                },
                {
                  type: "link",
                  text: "Rzecznika Praw Obywatelskich",
                  href: "https://www.rpo.gov.pl",
                },
                { type: "text", text: "." },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "kompatybilnosc",
      title: "Kompatybilność i skróty klawiaturowe",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "list",
              ordered: false,
              items: [
                [
                  {
                    type: "text",
                    text: "Serwis jest rozpoznawalny przez programy czytające dla osób niewidomych, takie jak NVDA czy JAWS.",
                  },
                ],
                [
                  {
                    type: "text",
                    text: "Obsługa serwisu możliwa jest zarówno przy pomocy klawiatury, jak i myszki.",
                  },
                ],
                [
                  {
                    type: "text",
                    text: "Serwis jest wyposażony w mechanizmy ułatwiające przeglądanie treści przez osoby niedowidzące, w tym zmianę kontrastu.",
                  },
                ],
                [
                  {
                    type: "text",
                    text: "Serwis nie definiuje własnych skrótów klawiaturowych, które mogłyby wchodzić w konflikt z technologiami asystującymi. Działają standardowe skróty przeglądarki.",
                  },
                ],
              ],
            },
          ],
        },
      ],
    },
  ],
};
