import type { ContentPage } from "@zsm3/contracts/content";

export const skrzynka: ContentPage = {
  path: "/skrzynka",
  kicker: "Zgłoszenia anonimowe · ZSM3",
  title: "Skrzynka zaufania",
  intro:
    "Jeśli dzieje się coś, o czym trudno powiedzieć wprost, możesz zgłosić to anonimowo. Zgłoszenia trafiają do pedagoga, psychologa oraz dyrekcji szkoły.",
  sections: [
    {
      id: "jak-to-dziala",
      title: "Jak to działa",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Szkoła prowadzi anonimowy kanał kontaktu z pedagogiem, psychologiem i dyrekcją. Nie musisz podawać imienia, nazwiska ani klasy.",
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
                    text: "Zgłoszenie możesz opisać własnymi słowami — liczy się to, co się stało, a nie forma.",
                  },
                ],
                [
                  {
                    type: "text",
                    text: "Jeśli chcesz odpowiedzi, zostaw dowolny sposób kontaktu. Bez niego zgłoszenie trafi do specjalistów, ale nie będzie można Ci odpisać.",
                  },
                ],
                [
                  {
                    type: "text",
                    text: "Zgłoszenia czytają wyłącznie pedagog, psycholog i dyrekcja szkoły.",
                  },
                ],
              ],
            },
          ],
        },
      ],
    },
    {
      id: "kiedy-zglosic",
      title: "Kiedy warto zgłosić sprawę",
      blocks: [
        {
          type: "timeline",
          items: [
            {
              label: "Przemoc",
              title: "Przemoc i agresja",
              text: "Przemoc fizyczna lub słowna, zastraszanie, wykluczanie z grupy, przemoc w internecie.",
            },
            {
              label: "Trudności",
              title: "Trudna sytuacja osobista",
              text: "Problemy w domu, samopoczucie, stres, sytuacje, w których potrzebujesz rozmowy ze specjalistą.",
            },
            {
              label: "Zagrożenie",
              title: "Niebezpieczne sytuacje w szkole",
              text: "Zachowania zagrażające zdrowiu lub bezpieczeństwu uczniów na terenie szkoły.",
            },
          ],
        },
      ],
    },
    {
      id: "pilna-pomoc",
      title: "Jeśli sprawa jest pilna",
      blocks: [
        {
          type: "callout",
          title: "Nie czekaj na odpowiedź na zgłoszenie",
          text: "W sytuacji zagrożenia życia lub zdrowia zgłoś się bezpośrednio do pedagoga, psychologa, wychowawcy albo do sekretariatu szkoły. Numer alarmowy to 112.",
          link: { label: "Pomoc w szkole", href: "/szkola/pomoc" },
        },
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Całodobowy, bezpłatny telefon zaufania dla dzieci i młodzieży: ",
                },
                { type: "link", text: "116 111", href: "tel:116111" },
                { type: "text", text: "." },
              ],
            },
          ],
        },
      ],
    },
  ],
};
