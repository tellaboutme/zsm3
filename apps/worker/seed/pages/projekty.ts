import type { ContentPage } from "@zsm3/contracts/content";

export const projekty: ContentPage = {
  path: "/szkola/projekty",
  kicker: "Projekty · rozwój · współpraca",
  title: "Projekty ZSM3",
  intro:
    "Uczniowie Zespołu Szkół Mechanicznych Nr 3 w Krakowie uczestniczą w projektach edukacyjnych, zawodowych, międzynarodowych i rozwojowych. Projekty uzupełniają codzienne kształcenie i pozwalają zdobywać doświadczenie przydatne w dalszej nauce i pracy.",
  sections: [
    {
      id: "w-skrocie",
      title: "W skrócie",
      blocks: [
        {
          type: "facts",
          label: "Projekty w liczbach",
          facts: [
            { value: "9", label: "projektów i inicjatyw" },
            { value: "3", label: "obszary tematyczne" },
            { value: "Erasmus+", label: "współpraca międzynarodowa" },
          ],
        },
      ],
    },
    {
      id: "wspolpraca",
      title: "Współpraca i doświadczenie",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Międzynarodowa współpraca, wyjazdy, integracja i doświadczenia zdobywane poza szkolną pracownią.",
                },
              ],
            },
          ],
        },
        {
          type: "timeline",
          items: [
            {
              label: "Erasmus+",
              title: "Erasmus+",
              text: "Działania szkoły realizowane w ramach programu Erasmus+, w tym akredytacja oraz wyjazdy zagraniczne uczniów.",
            },
            {
              label: "POWER",
              title: "POWER",
              text: "Staże zagraniczne, w ramach których uczniowie zdobywają doświadczenie zawodowe poza granicami Polski.",
            },
            {
              label: "Góry",
              title: "Złap oddech w górach",
              text: "Aktywność, integracja i wspólne zdobywanie nowych doświadczeń poza budynkiem szkoły.",
            },
          ],
        },
      ],
    },
    {
      id: "kompetencje",
      title: "Kompetencje zawodowe",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Projekty, które pomagają poznawać zawody, rozwijać umiejętności praktyczne i planować własną ścieżkę zawodową.",
                },
              ],
            },
          ],
        },
        {
          type: "timeline",
          items: [
            {
              label: "CKZ",
              title: "Centrum Kompetencji Zawodowych",
              text: "Projekty wspierające rozwój kwalifikacji i umiejętności zawodowych uczniów.",
            },
            {
              label: "Zawody",
              title: "Wędrówka po świecie zawodów",
              text: "Poznawanie świata zawodów oraz możliwości dalszego rozwoju i kształcenia.",
            },
            {
              label: "Rajd",
              title: "Rajd po fach",
              text: "Projekt przybliżający młodzieży kształcenie zawodowe i jego możliwości.",
            },
          ],
        },
      ],
    },
    {
      id: "edukacja",
      title: "Edukacja i rozwój",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Nowoczesna edukacja, przedsiębiorczość i inicjatywy rozwijające zainteresowania uczniów.",
                },
              ],
            },
          ],
        },
        {
          type: "timeline",
          items: [
            {
              label: "MChE",
              title: "Małopolska Chmura Edukacyjna",
              text: "Nowoczesne rozwiązania edukacyjne oraz zajęcia rozwijające zainteresowania uczniów.",
            },
            {
              label: "PURWM",
              title: "PURWM",
              text: "Informacje, działania i materiały związane z realizacją projektu.",
            },
            {
              label: "Start-Up",
              title: "Start-Up: Startuj po marzenia",
              text: "Rozwijanie pomysłów, kompetencji i przedsiębiorczego myślenia uczniów.",
            },
          ],
        },
        {
          type: "callout",
          title: "Więcej niż szkoła",
          text: "Bieżące informacje o naborach, wyjazdach i rezultatach projektów publikujemy w aktualnościach szkolnych.",
          link: { label: "Aktualności", href: "/aktualnosci" },
        },
      ],
    },
  ],
};
