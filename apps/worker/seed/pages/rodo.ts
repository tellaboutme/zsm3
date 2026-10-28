import type { ContentPage } from "@zsm3/contracts/content";

export const rodo: ContentPage = {
  path: "/rodo",
  kicker: "Ochrona danych osobowych · ZSM3",
  title: "Ochrona danych osobowych",
  intro:
    "W jednym miejscu zebraliśmy informacje i klauzule dotyczące przetwarzania danych osobowych w Zespole Szkół Mechanicznych Nr 3 w Krakowie oraz zasady korzystania z serwisu internetowego szkoły.",
  sections: [
    {
      id: "zakresy",
      title: "Zakresy informacji",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Informacje o przetwarzaniu danych osobowych podzieliliśmy na cztery zakresy. Wybierz ten, który Cię dotyczy.",
                },
              ],
            },
            {
              type: "list",
              ordered: false,
              items: [
                [
                  { type: "text", text: "Serwis internetowy: ", marks: ["bold"] },
                  {
                    type: "text",
                    text: "zasady dotyczące prywatności, danych osobowych oraz korzystania ze strony szkoły.",
                  },
                ],
                [
                  { type: "text", text: "Monitoring wizyjny: ", marks: ["bold"] },
                  {
                    type: "text",
                    text: "informacja administratora dotycząca przetwarzania danych w związku z monitoringiem na terenie szkoły.",
                  },
                ],
                [
                  { type: "text", text: "Rekrutacja: ", marks: ["bold"] },
                  {
                    type: "text",
                    text: "informacja dotycząca przetwarzania danych osobowych kandydatów w procesie rekrutacji do szkoły.",
                  },
                ],
                [
                  { type: "text", text: "Klauzule informacyjne: ", marks: ["bold"] },
                  {
                    type: "text",
                    text: "dokumenty dotyczące wizerunku, potwierdzenia woli oraz danych osobowych pracowników.",
                  },
                ],
              ],
            },
          ],
        },
        {
          type: "callout",
          title: "Polityka prywatności serwisu",
          text: "Szczegółowe zasady dotyczące funkcjonowania serwisu internetowego, plików cookie i danych przetwarzanych przez stronę znajdują się w Polityce prywatności ZSM3.",
          link: { label: "Polityka prywatności", href: "/polityka-prywatnosci" },
        },
      ],
    },
    {
      id: "dokumenty",
      title: "Dokumenty i klauzule",
      blocks: [
        {
          type: "timeline",
          items: [
            {
              label: "01",
              title: "Informacja administratora o przetwarzaniu danych",
              text: "Ogólna klauzula informacyjna dotycząca zasad przetwarzania danych osobowych przez szkołę.",
            },
            {
              label: "02",
              title: "Fotografowanie i wykorzystanie wizerunku",
              text: "Dokument dotyczący zgody na fotografowanie, nagrywanie oraz wykorzystanie wizerunku ucznia.",
            },
            {
              label: "03",
              title: "Potwierdzenie woli — rekrutacja",
              text: "Informacja administratora dotycząca danych przetwarzanych w związku z procesem rekrutacji.",
            },
            {
              label: "04",
              title: "Dane osobowe pracownika",
              text: "Informacja administratora dotycząca przetwarzania danych osobowych związanych z zatrudnieniem.",
            },
          ],
        },
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Pełna treść klauzul znajduje się w dokumentach opublikowanych przez szkołę. Powyższa lista służy wyłącznie do uporządkowania materiałów.",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "kontakt",
      title: "Kontakt w sprawie danych osobowych",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Administratorem danych jest Zespół Szkół Mechanicznych Nr 3 im. gen. Władysława Sikorskiego w Krakowie, osiedle Szkolne 37, 31-978 Kraków. W sprawach dotyczących przetwarzania danych osobowych prosimy o kontakt z sekretariatem: ",
                },
                {
                  type: "link",
                  text: "s@zespolszkolmechanicznych.edu.pl",
                  href: "mailto:s@zespolszkolmechanicznych.edu.pl",
                },
                { type: "text", text: " lub " },
                { type: "link", text: "+48 12 644 06 89", href: "tel:+48126440689" },
                { type: "text", text: "." },
              ],
            },
          ],
        },
      ],
    },
  ],
};
