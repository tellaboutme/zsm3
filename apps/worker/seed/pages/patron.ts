import type { ContentPage } from "@zsm3/contracts/content";

export const patron: ContentPage = {
  path: "/szkola/patron",
  kicker: "Szkoła · patron od 1982 roku",
  title: "Gen. Władysław Sikorski",
  intro:
    "Inżynier, żołnierz i mąż stanu: uczestnik walki o niepodległość, dowódca 5. Armii w 1920 roku, premier Rzeczypospolitej i Naczelny Wódz Polskich Sił Zbrojnych w czasie II wojny światowej.",
  sections: [
    {
      id: "w-skrocie",
      title: "W skrócie",
      blocks: [
        {
          type: "facts",
          label: "Patron w liczbach",
          facts: [
            { value: "1881–1943", label: "lata życia" },
            { value: "1920", label: "dowódca 5. Armii" },
            { value: "1922–1923", label: "prezes Rady Ministrów" },
            { value: "1939–1943", label: "premier i Naczelny Wódz" },
          ],
        },
      ],
    },
    {
      id: "zycie",
      title: "Życie",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Biografia generała łączy działalność niepodległościową, wykształcenie techniczne, służbę wojskową i najwyższe funkcje państwowe. Był absolwentem Politechniki Lwowskiej.",
                },
              ],
            },
            {
              type: "list",
              ordered: false,
              items: [
                [{ type: "text", text: "Inżynier: absolwent Politechniki Lwowskiej." }],
                [{ type: "text", text: "Żołnierz: oficer i generał walczący o niepodległość." }],
                [{ type: "text", text: "Dowódca: 5. Armia w Bitwie Warszawskiej 1920 roku." }],
                [
                  {
                    type: "text",
                    text: "Mąż stanu: premier i Naczelny Wódz w czasie II wojny światowej.",
                  },
                ],
              ],
            },
          ],
        },
      ],
    },
    {
      id: "kalendarium",
      title: "Kalendarium",
      blocks: [
        {
          type: "timeline",
          items: [
            {
              label: "1881",
              title: "Narodziny",
              text: "20 maja w Tuszowie Narodowym koło Mielca.",
            },
            {
              label: "1902",
              title: "Studia we Lwowie",
              text: "Matura i początek studiów na Politechnice Lwowskiej.",
            },
            { label: "1920", title: "Bitwa Warszawska", text: "Dowódca 5. Armii." },
            { label: "1922–1923", title: "Premier", text: "Prezes Rady Ministrów." },
            {
              label: "1939–1943",
              title: "Naczelny Wódz",
              text: "Premier i Naczelny Wódz Polskich Sił Zbrojnych.",
            },
          ],
        },
      ],
    },
    {
      id: "w-szkole",
      title: "Patron w szkole",
      blocks: [
        {
          type: "callout",
          title: "Dzień Patrona",
          text: "Szkoła nosi imię generała od 23 października 1982 roku, a jego pomnik stoi na skwerze przed budynkiem. W 2026 roku Dzień Patrona połączono ze ślubowaniem klas pierwszych i złożeniem kwiatów przed pomnikiem.",
          link: { label: "Terminarz roku szkolnego", href: "/szkola/terminarz" },
        },
      ],
    },
  ],
};
