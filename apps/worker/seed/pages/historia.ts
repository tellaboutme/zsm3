import type { ContentPage } from "@zsm3/contracts/content";

export const historia: ContentPage = {
  path: "/szkola/historia",
  kicker: "Szkoła · od 1950 roku",
  title: "Historia szkoły",
  intro:
    "Od szkoły hutniczej do szkoły technicznej z motoryzacją, lotnictwem i informatyką. Przez ponad siedem dekad zmieniały się nazwy i kierunki, a techniczny charakter szkoły pozostał.",
  sections: [
    {
      id: "w-skrocie",
      title: "W skrócie",
      blocks: [
        {
          type: "facts",
          label: "Historia w liczbach",
          facts: [
            { value: "1950/51", label: "początki szkoły" },
            { value: "1959", label: "budynek na os. Szkolnym 37" },
            { value: "1972", label: "nazwa Zespół Szkół Mechanicznych nr 3" },
            { value: "1982", label: "imię gen. Władysława Sikorskiego" },
          ],
        },
      ],
    },
    {
      id: "poczatki",
      title: "Początki",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "W roku szkolnym 1950/51 powstało Liceum Przemysłu Węglowego z klasą o specjalności hutniczej. Kilka lat później z tej klasy wyrosło samodzielne Technikum Hutnicze, a w kolejnych dekadach coraz ważniejsze stawało się kształcenie mechaniczne i samochodowe.",
                },
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
              label: "1950/51",
              title: "Liceum Przemysłu Węglowego",
              text: "Pierwsza siedziba przy ul. Brzozowej 5 i klasa o specjalności hutniczej.",
            },
            {
              label: "1952/53",
              title: "Technikum Hutnicze",
              text: "Szkoła przenosi się na ul. Loretańską 16 i zaczyna samodzielną historię.",
            },
            {
              label: "1954",
              title: "Nowa Huta",
              text: "Technikum przenosi się do budynku przy ul. Frontu Narodowego 10.",
            },
            {
              label: "1959",
              title: "Obecna siedziba",
              text: "Przeprowadzka do nowego budynku, dziś os. Szkolne 37.",
            },
            {
              label: "1962",
              title: "Technikum Hutniczo-Mechaniczne",
              text: "Duża szkoła z własnymi warsztatami i internatem: ponad 50 oddziałów i około 2000 uczniów.",
            },
            {
              label: "1969/70",
              title: "Motoryzacja",
              text: "Pierwsze klasy o specjalności samochodowej.",
            },
            {
              label: "1972",
              title: "Zespół Szkół Mechanicznych nr 3",
              text: "Szkoła otrzymuje nazwę, pod którą działa do dziś.",
            },
            {
              label: "1982",
              title: "Patron szkoły",
              text: "23 października szkoła otrzymuje imię gen. Władysława Sikorskiego, a przed budynkiem staje pomnik patrona.",
            },
            {
              label: "1991–1999",
              title: "Nowe szkoły",
              text: "Powstają XIX Liceum Ogólnokształcące, Liceum Techniczne i Policealne Studium Zawodowe.",
            },
          ],
        },
      ],
    },
    {
      id: "dzis",
      title: "Dziś",
      blocks: [
        {
          type: "callout",
          title: "Tradycja techniczna i nowe zawody",
          text: "Szkoła łączy wieloletnią tradycję z kształceniem w informatyce, robotyce, elektromobilności i lotnictwie.",
          link: { label: "Zobacz zawody", href: "/kandydaci/zawody" },
        },
      ],
    },
  ],
};
