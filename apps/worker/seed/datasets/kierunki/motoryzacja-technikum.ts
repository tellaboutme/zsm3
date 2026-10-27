import type { Programme } from "@zsm3/contracts/programmes";

const mot02 = { code: "MOT.02", name: "Mechatronika samochodowa" } as const;
const mot06 = {
  code: "MOT.06",
  name: "Organizacja obsługi pojazdów",
  scope: "Organizacja i prowadzenie procesu obsługi pojazdów samochodowych.",
} as const;
const mot07 = {
  code: "MOT.07",
  name: "Pojazdy zero- i niskoemisyjne",
  scope:
    "Organizacja i prowadzenie procesu obsługi i naprawy pojazdów zeroemisyjnych i niskoemisyjnych.",
} as const;

const electricLearn = [
  {
    title: "Napędy elektryczne",
    text: "Budowa i zasada działania elektrycznych układów napędowych pojazdów.",
  },
  {
    title: "Pojazdy hybrydowe",
    text: "Współpraca silnika spalinowego z elektrycznym układem napędowym.",
  },
  {
    title: "Baterie trakcyjne",
    text: "Budowa, diagnostyka i obsługa wysokonapięciowych magazynów energii.",
  },
  {
    title: "Układy ładowania",
    text: "Diagnostyka i obsługa systemów odpowiedzialnych za ładowanie pojazdu.",
  },
  { title: "Diagnostyka EV", text: "Wykrywanie usterek i analiza parametrów systemów pojazdu." },
  { title: "Bezpieczeństwo HV", text: "Bezpieczna praca przy instalacjach wysokiego napięcia." },
];

const electricCareers = [
  { title: "Serwisy EV", text: "Diagnostyka i obsługa samochodów elektrycznych i hybrydowych." },
  { title: "Autoryzowane serwisy", text: "Praca przy nowych modelach z napędem elektrycznym." },
  { title: "Diagnostyka", text: "Diagnostyka instalacji i systemów wysokonapięciowych." },
  {
    title: "Nowa motoryzacja",
    text: "Elektromobilność, infrastruktura i nowe technologie transportu.",
  },
];

export const motoryzacjaTechnikum: readonly Programme[] = [
  {
    slug: "technik-pojazdow-samochodowych",
    profession: "technik-pojazdow-samochodowych",
    school: "technikum",
    lead: "Poznajesz diagnostykę, mechanikę i systemy współczesnych samochodów oraz pracę w serwisie, stacji diagnostycznej i własnym warsztacie.",
    learn: [
      { title: "Diagnostyka", text: "Wykrywanie usterek i komputerowa diagnostyka pojazdów." },
      { title: "Mechanika", text: "Silniki, hamulce, zawieszenie, układ kierowniczy i napędowy." },
      { title: "Elektronika", text: "Elektryczne i elektroniczne systemy samochodu." },
      { title: "Serwis", text: "Przeglądy, obsługa techniczna i naprawy pojazdów." },
      {
        title: "Wyposażenie warsztatu",
        text: "Praca z profesjonalnymi urządzeniami warsztatowymi.",
      },
      { title: "Rynek pracy", text: "Serwisy, stacje diagnostyczne i własna działalność." },
    ],
    tools: [],
    practice: [
      "Zajęcia praktyczne w warsztatach szkolnych",
      "Diagnostyka współczesnych pojazdów",
      "Przygotowanie do realnej pracy w zawodzie",
    ],
    exams: [
      {
        code: "MOT.05",
        name: "Mechanika samochodowa",
        scope: "Obsługa, diagnozowanie oraz naprawa pojazdów samochodowych.",
        alternative: mot02,
      },
      mot06,
    ],
    careers: [],
    drivingLicence: "B",
    erasmus: false,
  },
  {
    slug: "technik-elektromobilnosci",
    profession: "technik-elektromobilnosci",
    school: "technikum",
    lead: "Uczysz się obsługi, diagnostyki i naprawy pojazdów elektrycznych, hybrydowych oraz innych pojazdów nisko- i zeroemisyjnych. Zawód wprowadzono do szkół w roku 2024/2025.",
    learn: electricLearn,
    tools: [
      "Pojazdy elektryczne",
      "Napędy hybrydowe",
      "Baterie trakcyjne",
      "Systemy ładowania",
      "Wysokie napięcie",
      "Diagnostyka",
    ],
    practice: [],
    exams: [
      {
        ...mot02,
        scope:
          "Obsługa, diagnozowanie oraz naprawa mechatronicznych systemów pojazdów samochodowych.",
      },
      mot07,
    ],
    careers: electricCareers,
    erasmus: false,
  },
  {
    slug: "technik-pojazdow-samochodowych-branzowa-ii",
    profession: "technik-pojazdow-samochodowych",
    school: "branzowa-2",
    lead: "Masz już zawód mechanika lub elektromechanika. Uczysz się organizować pracę serwisu, prowadzić proces obsługi samochodów i zdobywasz tytuł technika.",
    learn: [
      {
        title: "Zaawansowana diagnostyka",
        text: "Ocena stanu pojazdu, analiza usterek i dobór metod naprawy.",
      },
      {
        title: "Organizacja serwisu",
        text: "Planowanie i organizowanie obsługi oraz naprawy samochodów.",
      },
      { title: "Nadzorowanie napraw", text: "Kontrola przebiegu i jakości prac serwisowych." },
      { title: "Badania techniczne", text: "Zasady kontroli i badań technicznych pojazdów." },
      { title: "Dokumentacja", text: "Zlecenia, dokumentacja napraw i rozliczenie prac." },
      {
        title: "Obsługa klienta",
        text: "Przyjęcie pojazdu, planowanie prac i doradztwo techniczne.",
      },
    ],
    tools: [
      "Diagnostyka",
      "Serwis",
      "Organizacja",
      "Dokumentacja",
      "Nadzór",
      "Doradztwo techniczne",
    ],
    practice: [
      "Diagnostyka i obsługa współczesnych samochodów",
      "Specjalistyczne stanowiska i urządzenia serwisowe",
      "Organizacja rzeczywistego procesu naprawy pojazdu",
    ],
    exams: [mot06],
    careers: [
      { title: "Autoryzowane serwisy", text: "Obsługa, diagnostyka i organizacja napraw." },
      { title: "Warsztaty samochodowe", text: "Praca techniczna i nadzorowanie procesu naprawy." },
      { title: "Stacje obsługi pojazdów", text: "Diagnostyka, przeglądy i obsługa samochodów." },
      { title: "Własna działalność", text: "Prowadzenie firmy w branży motoryzacyjnej." },
    ],
    entry:
      "Absolwenci branżowej szkoły I stopnia z kwalifikacją MOT.05 (mechanik pojazdów samochodowych) lub MOT.02 (elektromechanik pojazdów samochodowych).",
    erasmus: false,
  },
  {
    slug: "technik-elektromobilnosci-branzowa-ii",
    profession: "technik-elektromobilnosci",
    school: "branzowa-2",
    lead: "Po elektromechaniku rozwijasz kwalifikacje w kierunku samochodów elektrycznych, hybrydowych i innych nowoczesnych napędów.",
    learn: electricLearn,
    tools: [
      "Pojazdy elektryczne",
      "Napędy hybrydowe",
      "Baterie trakcyjne",
      "Systemy ładowania",
      "Wysokie napięcie",
      "Diagnostyka",
    ],
    practice: [
      "Diagnostyka elektrycznych układów napędowych",
      "Obsługa pojazdów zero- i niskoemisyjnych",
      "Organizacja procesu serwisowego i naprawy",
    ],
    exams: [mot07],
    careers: electricCareers,
    entry:
      "Absolwenci branżowej szkoły I stopnia z kwalifikacją MOT.02 (elektromechanik pojazdów samochodowych).",
    erasmus: false,
  },
];
