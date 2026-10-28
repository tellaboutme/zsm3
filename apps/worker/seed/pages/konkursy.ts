import type { ContentPage } from "@zsm3/contracts/content";

export const konkursy: ContentPage = {
  path: "/konkursy",
  kicker: "Konkursy szkolne · ZSM3",
  title: "Konkursy szkolne",
  intro:
    "Konkursy organizowane dla uczniów Zespołu Szkół Mechanicznych Nr 3 w Krakowie. Są okazją do rozwijania zainteresowań, prezentowania talentów i aktywnego udziału w życiu szkoły.",
  sections: [
    {
      id: "konkursy-szkolne",
      title: "Konkursy szkolne",
      blocks: [
        {
          type: "timeline",
          items: [
            {
              label: "Foto",
              title: "Szkolny konkurs fotograficzny",
              text: "Konkurs dla uczniów zainteresowanych fotografią i kreatywnym spojrzeniem na otaczający świat.",
            },
            {
              label: "Talent",
              title: "Szkolny konkurs Mam Talent",
              text: "Przestrzeń dla uczniów, którzy chcą zaprezentować swoje umiejętności, zainteresowania i talenty.",
            },
          ],
        },
      ],
    },
    {
      id: "olimpiady",
      title: "Olimpiady i konkursy zewnętrzne",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Uczniowie szkoły startują także w konkursach i olimpiadach organizowanych poza szkołą, między innymi o tematyce ekonomicznej, przedsiębiorczej i zawodowej.",
                },
              ],
            },
            {
              type: "list",
              ordered: false,
              items: [
                [{ type: "text", text: "Olimpiada Wiedzy Ekonomicznej." }],
                [{ type: "text", text: "Olimpiada Przedsiębiorczości." }],
                [{ type: "text", text: "Olimpiada Wiedzy o Ubezpieczeniach Społecznych." }],
                [{ type: "text", text: "Turniej Wiedzy Samochodowej." }],
              ],
            },
          ],
        },
        {
          type: "callout",
          title: "Pokaż, co potrafisz",
          text: "Informacje o terminach, regulaminach i wynikach poszczególnych konkursów publikujemy w aktualnościach szkolnych.",
          link: { label: "Aktualności", href: "/aktualnosci" },
        },
      ],
    },
  ],
};
