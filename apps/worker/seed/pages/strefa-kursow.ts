import type { ContentPage } from "@zsm3/contracts/content";

export const strefaKursow: ContentPage = {
  path: "/uczniowie/strefa-kursow",
  kicker: "Uczniowie · kursy online",
  title: "Strefa Kursów",
  intro:
    "Uczniowie ZSM3 korzystają bezpłatnie ze szkoleń internetowych udostępnionych szkole przez firmę Strefa Kursów.",
  sections: [
    {
      id: "dostep",
      title: "Jak skorzystać",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Kursy obejmują między innymi grafikę, programowanie, obsługę programów biurowych i technologie internetowe. Dostęp dla uczniów organizuje szkoła — po szczegóły zgłoś się do sekretariatu uczniowskiego albo do nauczyciela przedmiotów zawodowych.",
                },
              ],
            },
          ],
        },
        {
          type: "callout",
          title: "Dziękujemy za wsparcie",
          text: "Szkolenia są udostępniane uczniom nieodpłatnie dzięki uprzejmości firmy Strefa Kursów.",
        },
      ],
    },
  ],
};
