import type { ContentPage } from "@zsm3/contracts/content";

export const oSzkole: ContentPage = {
  path: "/szkola/o-szkole",
  kicker: "Zespół Szkół Mechanicznych Nr 3 · Kraków",
  title: "O szkole",
  intro:
    "Kadra, terminy, wsparcie ucznia, zdrowie i biblioteka — najważniejsze informacje związane z codziennym funkcjonowaniem Zespołu Szkół Mechanicznych Nr 3 im. gen. Władysława Sikorskiego w Krakowie.",
  sections: [
    {
      id: "najwazniejsze",
      title: "Najczęściej szukane",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Szybki dostęp do informacji, których najczęściej szukają uczniowie i rodzice.",
                },
              ],
            },
          ],
        },
        {
          type: "callout",
          title: "Grono pedagogiczne",
          text: "Wykaz nauczycieli ZSM3 wraz z nauczanymi przedmiotami i pełnionymi funkcjami.",
          link: { label: "Zobacz grono pedagogiczne", href: "/szkola/kadra" },
        },
        {
          type: "callout",
          title: "Terminarz roku szkolnego",
          text: "Najważniejsze terminy, praktyki, klasyfikacja, egzaminy, dni wolne oraz zebrania z rodzicami.",
          link: { label: "Otwórz terminarz", href: "/szkola/terminarz" },
        },
      ],
    },
    {
      id: "wsparcie",
      title: "Pomoc i wsparcie ucznia",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "W szkole dostępni są specjaliści, do których uczeń może zwrócić się w sprawach związanych z nauką, samopoczuciem i trudnościami.",
                },
              ],
            },
          ],
        },
        {
          type: "timeline",
          items: [
            {
              label: "Pedagog",
              title: "Pedagog szkolny",
              text: "Pomoc uczniom w trudnościach szkolnych, wychowawczych i osobistych.",
            },
            {
              label: "Pedagog specjalny",
              title: "Pedagog specjalny",
              text: "Wsparcie dostosowane do indywidualnych potrzeb edukacyjnych i rozwojowych ucznia.",
            },
            {
              label: "Psycholog",
              title: "Psycholog szkolny",
              text: "Pomoc psychologiczna, rozmowa, konsultacje i wsparcie w trudnych sytuacjach.",
            },
          ],
        },
        {
          type: "callout",
          title: "Kontakt anonimowy",
          text: "Uczniowie mogą skorzystać z anonimowego kontaktu z pedagogiem, psychologiem oraz dyrekcją szkoły.",
          link: { label: "Anonimowe zgłoszenie", href: "/skrzynka" },
        },
      ],
    },
    {
      id: "na-co-dzien",
      title: "Szkoła na co dzień",
      blocks: [
        {
          type: "timeline",
          items: [
            {
              label: "Biblioteka",
              title: "Biblioteka szkolna",
              text: "Godziny pracy biblioteki, kontakt, konkursy i szkolne inicjatywy czytelnicze.",
            },
            {
              label: "Pielęgniarka",
              title: "Gabinet pielęgniarski",
              text: "Informacje o opiece pielęgniarskiej oraz godzinach pracy gabinetu w szkole.",
            },
            {
              label: "Stomatologia",
              title: "Opieka stomatologiczna",
              text: "Informacje dotyczące podmiotu zapewniającego uczniom szkoły opiekę stomatologiczną.",
            },
          ],
        },
        {
          type: "callout",
          title: "Nie znalazłeś informacji?",
          text: "Skontaktuj się z sekretariatem szkoły. Pomożemy wskazać właściwą osobę lub miejsce.",
          link: { label: "Przejdź do kontaktu", href: "/kontakt" },
        },
      ],
    },
  ],
};
