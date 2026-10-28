import type { ContentPage } from "@zsm3/contracts/content";

export const kierownictwo: ContentPage = {
  path: "/rodzice/kierownictwo",
  kicker: "Kierownictwo i administracja · ZSM3",
  title: "Kierownictwo szkoły",
  intro:
    "Dane kontaktowe do osób odpowiedzialnych za kierowanie Zespołem Szkół Mechanicznych Nr 3 w Krakowie, kształcenie praktyczne, finanse i administrację. Przy połączeniu zwróć uwagę na właściwy numer wewnętrzny podany przy danej funkcji.",
  sections: [
    {
      id: "numery-glowne",
      title: "Numery główne",
      blocks: [
        {
          type: "facts",
          label: "Centrale telefoniczne",
          facts: [
            { value: "12 644 24 37", label: "dyrekcja i szkolenie praktyczne" },
            { value: "12 644 06 89", label: "administracja i księgowość" },
          ],
        },
      ],
    },
    {
      id: "dyrekcja",
      title: "Dyrekcja",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "table",
              caption: "Dyrekcja szkoły — numery wewnętrzne i adresy funkcyjne",
              header: ["Funkcja", "Telefon", "Adres e-mail"],
              rows: [
                ["Dyrektor szkoły", "12 644 24 37, wew. 12", "sekretariat szkoły"],
                ["Wicedyrektor", "12 644 24 37, wew. 26", "vice.zsm3@gmail.com"],
                ["Wicedyrektor", "12 644 24 37", "sekretariat szkoły"],
              ],
            },
          ],
        },
      ],
    },
    {
      id: "szkolenie-praktyczne",
      title: "Kształcenie praktyczne",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "table",
              caption: "Kierownik szkolenia praktycznego",
              header: ["Funkcja", "Telefon", "Adres e-mail"],
              rows: [
                ["Kierownik szkolenia praktycznego", "12 644 24 37, wew. 22", "ksp.zsm3@gmail.com"],
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Kierownik szkolenia praktycznego odpowiada za sprawy związane z organizacją kształcenia zawodowego, praktyk i zajęć praktycznych uczniów.",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "administracja",
      title: "Administracja i finanse",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "table",
              caption: "Administracja szkoły — numery wewnętrzne i adresy funkcyjne",
              header: ["Funkcja", "Telefon", "Adres e-mail"],
              rows: [
                ["Główny księgowy", "12 644 06 89, wew. 102", "k@zespolszkolmechanicznych.edu.pl"],
                [
                  "Kierownik administracji",
                  "12 644 06 89, wew. 101",
                  "admin@zespolszkolmechanicznych.edu.pl",
                ],
              ],
            },
          ],
        },
        {
          type: "callout",
          title: "Nie wiesz, do kogo się zwrócić?",
          text: "Sekretariat szkoły pomoże wskazać właściwą osobę lub komórkę organizacyjną. Pełne dane adresowe i godziny pracy znajdziesz na stronie kontaktowej.",
          link: { label: "Kontakt ze szkołą", href: "/kontakt" },
        },
      ],
    },
  ],
};
