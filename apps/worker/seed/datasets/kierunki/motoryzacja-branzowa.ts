import type { Programme } from "@zsm3/contracts/programmes";

export const motoryzacjaBranzowa: readonly Programme[] = [
  {
    slug: "mechanik-pojazdow-samochodowych",
    profession: "mechanik-pojazdow-samochodowych",
    school: "branzowa-1",
    lead: "Poznajesz samochód od strony praktycznej: od oceny stanu technicznego, przez diagnostykę, po serwis i naprawę.",
    learn: [
      {
        title: "Diagnostyka",
        text: "Ocena stanu technicznego pojazdu i ustalanie przyczyn niesprawności.",
      },
      {
        title: "Silniki",
        text: "Obsługa, demontaż, montaż i naprawa podstawowych zespołów silnika.",
      },
      {
        title: "Układy hamulcowe",
        text: "Kontrola, serwis i naprawa układów odpowiedzialnych za bezpieczeństwo.",
      },
      {
        title: "Zawieszenie",
        text: "Diagnostyka i naprawa zawieszenia oraz układu kierowniczego.",
      },
      { title: "Układ napędowy", text: "Sprzęgło, skrzynia biegów i przeniesienie napędu." },
      { title: "Serwis samochodowy", text: "Przeglądy, konserwacja i wymiana części." },
    ],
    tools: [],
    practice: [
      "Zajęcia praktyczne przy naprawie samochodów",
      "Specjalistyczne narzędzia i stanowiska serwisowe",
      "Doświadczenie przydatne od pierwszego dnia pracy",
    ],
    exams: [
      {
        code: "MOT.05",
        name: "Obsługa i naprawa pojazdów",
        scope: "Przeglądy, diagnozowanie stanu technicznego oraz obsługa i naprawa samochodów.",
      },
    ],
    careers: [],
    drivingLicence: "B",
    erasmus: false,
  },
  {
    slug: "elektromechanik-pojazdow-samochodowych",
    profession: "elektromechanik-pojazdow-samochodowych",
    school: "branzowa-1",
    lead: "Uczysz się diagnozować i naprawiać elektryczne, elektroniczne i mechatroniczne systemy samochodów: czujniki, instalacje i układy sterowania.",
    learn: [
      {
        title: "Diagnostyka komputerowa",
        text: "Wykrywanie usterek systemów elektrycznych, elektronicznych i mechatronicznych.",
      },
      {
        title: "Instalacje elektryczne",
        text: "Kontrola, obsługa i naprawa instalacji elektrycznej.",
      },
      {
        title: "Elektronika samochodowa",
        text: "Czujniki, moduły elektroniczne i układy sterujące.",
      },
      {
        title: "Systemy silnika",
        text: "Diagnostyka elektronicznych systemów jednostki napędowej.",
      },
      {
        title: "Bezpieczeństwo i komfort",
        text: "Elektroniczne systemy bezpieczeństwa i wyposażenia pojazdu.",
      },
      {
        title: "Pomiary i naprawa",
        text: "Pomiary, lokalizowanie uszkodzeń i sprawdzanie poprawności naprawy.",
      },
    ],
    tools: ["Czujniki", "Sterowniki", "Instalacje", "Diagnostyka", "Magistrale danych", "Pomiary"],
    practice: [
      "Diagnostyka elektryczna i elektroniczna",
      "Pomiary i lokalizowanie niesprawności",
      "Naprawa rzeczywistych układów samochodowych",
    ],
    exams: [
      {
        code: "MOT.02",
        name: "Systemy mechatroniczne pojazdów",
        scope:
          "Obsługa, diagnozowanie oraz naprawa mechatronicznych systemów pojazdów samochodowych.",
      },
    ],
    careers: [
      {
        title: "Serwisy samochodowe",
        text: "Diagnostyka i naprawa systemów elektrycznych i elektronicznych.",
      },
      {
        title: "Stacje diagnostyczne",
        text: "Kontrola stanu technicznego systemów i wyposażenia.",
      },
      {
        title: "Serwisy elektroniki",
        text: "Instalacje, sterowniki i elektroniczne wyposażenie pojazdów.",
      },
      { title: "Własny warsztat", text: "Rozwój zawodowy i własna działalność." },
    ],
    drivingLicence: "B",
    erasmus: false,
  },
  {
    slug: "mechanik-motocyklowy",
    profession: "mechanik-motocyklowy",
    school: "branzowa-1",
    lead: "Poznajesz budowę motocykli i skuterów, uczysz się diagnozować usterki, wykonywać przeglądy, regulacje i naprawy.",
    learn: [
      { title: "Diagnostyka", text: "Rozpoznawanie usterek i ocena stanu technicznego motocykla." },
      {
        title: "Silniki",
        text: "Obsługa, regulacja, demontaż, montaż i naprawa jednostek napędowych.",
      },
      { title: "Układ napędowy", text: "Sprzęgło, skrzynia biegów, łańcuch i pas." },
      {
        title: "Hamulce i zawieszenie",
        text: "Kontrola, serwis i naprawa układów odpowiedzialnych za bezpieczeństwo.",
      },
      {
        title: "Instalacja elektryczna",
        text: "Instalacje, układy zapłonowe i wyposażenie elektryczne.",
      },
      {
        title: "Przeglądy i serwis",
        text: "Przygotowanie motocykla do jazdy, regulacje i konserwacja.",
      },
    ],
    tools: ["Serwis", "Diagnostyka", "Regulacja", "Custom", "Sport", "Klasyki"],
    practice: [
      "Zajęcia praktyczne przy obsłudze motocykli",
      "Praca z profesjonalnymi narzędziami serwisowymi",
      "Praktyki w serwisach motocyklowych",
    ],
    exams: [
      {
        code: "MOT.04",
        name: "Obsługa i naprawa motocykli",
        scope: "Diagnozowanie, obsługa i naprawa pojazdów motocyklowych i ich podzespołów.",
      },
    ],
    careers: [
      {
        title: "Serwisy motocyklowe",
        text: "Obsługa, przeglądy i naprawa motocykli oraz skuterów.",
      },
      {
        title: "Salony motocyklowe",
        text: "Przygotowanie pojazdów, obsługa techniczna, części i akcesoria.",
      },
      {
        title: "Warsztaty specjalistyczne",
        text: "Custom, tuning i przygotowanie motocykli do sportu.",
      },
      { title: "Własny warsztat", text: "Rozwój zawodowy i własna działalność." },
    ],
    drivingLicence: "A",
    erasmus: false,
  },
];
