import type { ContentPage } from "@zsm3/contracts/content";

export const materialy: ContentPage = {
  path: "/uczniowie/materialy",
  kicker: "Materiały dla uczniów · informatyka",
  title: "Materiały dla uczniów",
  intro:
    "Egzaminy zawodowe, programowanie, systemy operacyjne i sieci komputerowe. Przed egzaminem zawsze sprawdzaj również aktualne informacje publikowane przez Centralną Komisję Egzaminacyjną.",
  sections: [
    {
      id: "cke",
      title: "Aktualne materiały egzaminacyjne",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Oficjalnym źródłem informacji o organizacji, zasadach i przebiegu egzaminów zawodowych oraz arkuszy egzaminacyjnych jest ",
                },
                {
                  type: "link",
                  text: "Centralna Komisja Egzaminacyjna",
                  href: "https://cke.gov.pl",
                },
                { type: "text", text: "." },
              ],
            },
            {
              type: "list",
              ordered: false,
              items: [
                [
                  {
                    type: "text",
                    text: "Informacje o organizacji i przebiegu egzaminu zawodowego.",
                  },
                ],
                [
                  {
                    type: "text",
                    text: "Oficjalne arkusze i materiały egzaminacyjne publikowane przez CKE.",
                  },
                ],
                [{ type: "text", text: "Komunikaty o terminach i wymaganiach egzaminacyjnych." }],
              ],
            },
          ],
        },
      ],
    },
    {
      id: "archiwum",
      title: "Archiwum E.14 i EE.09",
      blocks: [
        {
          type: "callout",
          title: "Materiały archiwalne",
          text: "Zestawy E.14 i EE.09 są archiwalne. Mogą służyć jako dodatkowe ćwiczenia z tworzenia stron, programowania i baz danych, ale nie stanowią aktualnego wykazu wymagań egzaminacyjnych.",
        },
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "W archiwum szkolnym znajdują się zestawy egzaminacyjne rozwiązywane przez uczniów ZSM3 w latach 2018 i 2019 oraz dodatkowe materiały do ćwiczeń z programowania i tworzenia stron internetowych.",
                },
              ],
            },
            {
              type: "list",
              ordered: false,
              items: [
                [{ type: "text", text: "Zestawy egzaminacyjne E.14 i EE.09 z lat 2018–2019." }],
                [{ type: "text", text: "Materiały do ćwiczeń z PHP oraz JavaScript." }],
                [{ type: "text", text: "Referaty dotyczące systemów operacyjnych." }],
              ],
            },
          ],
        },
      ],
    },
    {
      id: "systemy-i-sieci",
      title: "Systemy i sieci komputerowe",
      blocks: [
        {
          type: "timeline",
          items: [
            {
              label: "BASH I",
              title: "Skrypt BASH I",
              text: "Ćwiczenie wykorzystujące zmienne, wejście użytkownika, zapis do pliku oraz podstawowe polecenia systemowe.",
            },
            {
              label: "BASH II",
              title: "Skrypt BASH II",
              text: "Przykładowy skrypt wykorzystujący konstrukcję CASE oraz polecenia systemowe.",
            },
            {
              label: "Sieci",
              title: "Okablowanie strukturalne",
              text: "Interaktywne ćwiczenie dotyczące skrętki, standardów Ethernet, połączeń i elementów sieci komputerowej.",
            },
          ],
        },
        {
          type: "callout",
          title: "Potrzebujesz pliku lub dostępu?",
          text: "Materiały udostępniają nauczyciele przedmiotów informatycznych. W sprawach dostępu do plików zgłoś się do nauczyciela prowadzącego zajęcia.",
          link: { label: "Grono pedagogiczne", href: "/szkola/kadra" },
        },
      ],
    },
  ],
};
