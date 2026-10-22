import type { Programme } from "../../lib/programmes.ts";

export const mechatronika: readonly Programme[] = [
  {
    slug: "technik-robotyk",
    profession: "technik-robotyk",
    school: "technikum",
    lead: "Poznajesz budowę, programowanie i obsługę systemów robotyki: od montażu urządzenia po jego uruchomienie, diagnostykę i serwis.",
    learn: [
      {
        title: "Montaż robotów",
        text: "Montaż urządzeń, podzespołów oraz kompletnych systemów robotyki.",
      },
      {
        title: "Uruchamianie",
        text: "Konfiguracja i przygotowanie urządzeń oraz systemów robotyki do pracy.",
      },
      {
        title: "Programowanie",
        text: "Tworzenie i modyfikowanie programów sterujących pracą systemów robotyki.",
      },
      {
        title: "Diagnostyka",
        text: "Wykrywanie nieprawidłowości w działaniu urządzeń robotycznych.",
      },
      { title: "Eksploatacja", text: "Obsługa i użytkowanie urządzeń oraz systemów robotyki." },
      {
        title: "Konserwacja",
        text: "Utrzymywanie systemów robotycznych w dobrym stanie technicznym.",
      },
    ],
    tools: [],
    practice: [
      "Montaż i konfiguracja systemów",
      "Programowanie urządzeń robotycznych",
      "Diagnostyka, eksploatacja i konserwacja",
    ],
    exams: [
      {
        code: "ELM.07",
        name: "Montaż i uruchamianie systemów robotyki",
        scope: "Montaż, uruchamianie i obsługa urządzeń oraz systemów robotyki.",
      },
      {
        code: "ELM.08",
        name: "Programowanie systemów robotyki",
        scope: "Eksploatacja i programowanie urządzeń oraz systemów robotyki.",
      },
    ],
    careers: [
      {
        title: "Przemysł",
        text: "Roboty produkcyjne, automatyzacja procesów i linie technologiczne.",
      },
      { title: "Medycyna", text: "Urządzenia i systemy robotyczne wspierające medycynę." },
      {
        title: "Nowe technologie",
        text: "Robotyka razem z elektroniką, informatyką i systemami sterowania.",
      },
      {
        title: "Roboty usługowe",
        text: "Rozwiązania robotyczne w codziennym życiu, usługach i rozrywce.",
      },
    ],
    erasmus: false,
  },
  {
    slug: "technik-mechatronik",
    profession: "technik-mechatronik",
    school: "technikum",
    lead: "Łączysz mechanikę, elektronikę, automatykę i programowanie: budujesz, uruchamiasz i programujesz urządzenia oraz systemy mechatroniczne.",
    learn: [
      { title: "Mechanika", text: "Montaż, demontaż i obsługa mechanicznych elementów urządzeń." },
      {
        title: "Elektronika",
        text: "Układy elektryczne i elektroniczne, czujniki i elementy wykonawcze.",
      },
      {
        title: "Pneumatyka",
        text: "Projektowanie, montaż i uruchamianie układów na sprężone powietrze.",
      },
      {
        title: "Hydraulika",
        text: "Obsługa i diagnostyka układów hydraulicznych w maszynach i urządzeniach.",
      },
      {
        title: "Sterowniki PLC",
        text: "Programowanie sterowników i uruchamianie zautomatyzowanych procesów.",
      },
      { title: "Diagnostyka", text: "Pomiary, lokalizowanie usterek i konserwacja urządzeń." },
    ],
    tools: ["Mechanika", "Elektronika", "Pneumatyka", "Hydraulika", "Sterowniki PLC", "Automatyka"],
    practice: [
      "Stanowiska pneumatyczne i hydrauliczne",
      "Programowanie sterowników PLC",
      "Pomiary, diagnostyka i uruchamianie urządzeń",
    ],
    exams: [
      {
        code: "ELM.03",
        name: "Montaż i uruchamianie",
        scope: "Montaż, uruchamianie i konserwacja urządzeń i systemów mechatronicznych.",
      },
      {
        code: "ELM.06",
        name: "Eksploatacja i programowanie",
        scope: "Eksploatacja i programowanie urządzeń i systemów mechatronicznych.",
      },
    ],
    careers: [
      {
        title: "Automatyka przemysłowa",
        text: "Linie produkcyjne, automatyczne stanowiska i systemy sterowania.",
      },
      { title: "Roboty przemysłowe", text: "Montaż, uruchamianie i obsługa urządzeń w przemyśle." },
      {
        title: "Maszyny CNC",
        text: "Urządzenia sterowane komputerowo i systemy wspomagające produkcję.",
      },
      {
        title: "Inteligentne urządzenia",
        text: "Automatyczne bramy, systemy sterowania i rozwiązania smart.",
      },
    ],
    erasmus: false,
  },
];
