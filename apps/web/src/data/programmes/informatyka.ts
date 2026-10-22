import type { Programme } from "../../lib/programmes.ts";

export const informatyka: readonly Programme[] = [
  {
    slug: "technik-informatyk",
    profession: "technik-informatyk",
    school: "technikum",
    lead: "Uczysz się administrować systemami, budować sieci komputerowe, serwisować sprzęt oraz tworzyć strony, aplikacje internetowe i bazy danych.",
    learn: [
      {
        title: "Sprzęt komputerowy",
        text: "Dobór, montaż, konfiguracja, diagnostyka i serwis komputerów oraz urządzeń peryferyjnych.",
      },
      {
        title: "Systemy operacyjne",
        text: "Instalowanie, konfigurowanie i administrowanie współczesnymi systemami komputerowymi.",
      },
      {
        title: "Sieci komputerowe",
        text: "Projektowanie, budowa, konfiguracja i eksploatacja lokalnych sieci komputerowych.",
      },
      {
        title: "Strony i aplikacje WWW",
        text: "Tworzenie stron internetowych i aplikacji działających w przeglądarce.",
      },
      {
        title: "Bazy danych",
        text: "Projektowanie relacyjnych baz danych, język SQL i zarządzanie informacją.",
      },
      {
        title: "Cyberbezpieczeństwo",
        text: "Podstawy bezpiecznej konfiguracji urządzeń, systemów, sieci i usług.",
      },
    ],
    tools: ["Windows", "Linux", "Sieci LAN", "HTML, CSS, JavaScript", "SQL", "Serwery"],
    practice: [
      "Ćwiczenia w pracowniach komputerowych ze stanowiskami do konfiguracji sprzętu",
      "Praca z komputerami, sieciami i urządzeniami",
      "Projekty oparte na realnych problemach informatycznych",
    ],
    exams: [
      {
        code: "INF.02",
        name: "Systemy, sprzęt i sieci",
        scope:
          "Administracja i eksploatacja systemów komputerowych, urządzeń peryferyjnych i lokalnych sieci komputerowych.",
      },
      {
        code: "INF.03",
        name: "Strony WWW i bazy danych",
        scope:
          "Tworzenie i administrowanie stronami i aplikacjami internetowymi oraz bazami danych.",
      },
    ],
    careers: [
      {
        title: "Administrator systemów",
        text: "Konfiguracja systemów, kont użytkowników, usług i infrastruktury IT.",
      },
      {
        title: "Administrator sieci",
        text: "Budowa, konfiguracja, diagnostyka i utrzymanie sieci komputerowych.",
      },
      {
        title: "Serwisant IT",
        text: "Diagnostyka, naprawa i modernizacja komputerów oraz urządzeń.",
      },
      {
        title: "Web developer",
        text: "Strony, aplikacje internetowe i rozwiązania oparte na bazach danych.",
      },
    ],
    erasmus: false,
  },
  {
    slug: "technik-programista",
    profession: "technik-programista",
    school: "technikum",
    lead: "Uczysz się tworzyć strony internetowe, aplikacje desktopowe i mobilne, bazy danych oraz testować oprogramowanie.",
    learn: [
      {
        title: "Programowanie",
        text: "Tworzenie aplikacji i rozwiązywanie problemów w różnych językach programowania.",
      },
      {
        title: "Strony internetowe",
        text: "Projektowanie i tworzenie stron oraz aplikacji internetowych.",
      },
      {
        title: "Bazy danych",
        text: "Projektowanie, tworzenie i obsługa baz danych z użyciem języka SQL.",
      },
      {
        title: "Aplikacje",
        text: "Projektowanie i tworzenie aplikacji desktopowych oraz mobilnych.",
      },
      {
        title: "Testowanie",
        text: "Sprawdzanie poprawności działania oprogramowania i wyszukiwanie błędów.",
      },
      {
        title: "Gry i nowe technologie",
        text: "Wykorzystanie programowania przy grach, projektach 3D i innych rozwiązaniach IT.",
      },
    ],
    tools: ["Python", "C++", "C#", "HTML", "CSS", "JavaScript", "SQL"],
    practice: [
      "Pracownie komputerowe w szkole",
      "Zajęcia w Centrum Kształcenia Zawodowego",
      "Praktyki i staże w firmach z branży IT",
    ],
    exams: [
      {
        code: "INF.03",
        name: "Strony WWW i bazy danych",
        scope:
          "Tworzenie i administrowanie stronami i aplikacjami internetowymi oraz bazami danych.",
      },
      {
        code: "INF.04",
        name: "Projektowanie i programowanie aplikacji",
        scope: "Projektowanie, programowanie i testowanie aplikacji.",
      },
    ],
    careers: [],
    erasmus: true,
  },
];
