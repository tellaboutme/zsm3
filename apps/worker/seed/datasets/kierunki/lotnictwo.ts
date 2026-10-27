import type { Programme } from "@zsm3/contracts/programmes";

export const lotnictwo: readonly Programme[] = [
  {
    slug: "technik-awionik",
    profession: "technik-awionik",
    school: "technikum",
    lead: "Poznajesz systemy elektryczne i awioniczne statków powietrznych, ich diagnostykę i obsługę techniczną.",
    learn: [
      {
        title: "Systemy awioniczne",
        text: "Poznawanie, diagnozowanie i obsługa systemów awionicznych.",
      },
      {
        title: "Instalacje elektryczne",
        text: "Instalacje oraz wyposażenie elektryczne samolotów.",
      },
      {
        title: "Systemy pokładowe",
        text: "Przyrządy pilotażowe, radionawigacja, łączność i systemy wspomagania lotu.",
      },
      { title: "Budowa samolotu", text: "Płatowiec, napędy i wyposażenie statku powietrznego." },
      { title: "Obsługa techniczna", text: "Demontaż, sprawdzanie, naprawa i montaż elementów." },
      {
        title: "Dokumentacja lotnicza",
        text: "Dokumentacja techniczna po polsku i angielsku, standard ATA.",
      },
    ],
    tools: [],
    practice: [
      "Pracownie lotnicze i modelarnia",
      "Praktyki w lotnictwie cywilnym i wojskowym",
      "Zajęcia z czynnymi mechanikami lotniczymi z lotniska w Balicach",
    ],
    exams: [
      {
        code: "TLO.01",
        name: "Obsługa wyposażenia statków powietrznych",
        scope: "Obsługa techniczna wyposażenia awionicznego i elektrycznego statków powietrznych.",
      },
    ],
    careers: [],
    erasmus: true,
  },
  {
    slug: "technik-mechanik-lotniczy",
    profession: "technik-mechanik-lotniczy",
    school: "technikum",
    lead: "Poznajesz samolot od konstrukcji po zespół napędowy i uczysz się wykonywać przeglądy, inspekcje i naprawy statków powietrznych.",
    learn: [
      {
        title: "Budowa samolotu",
        text: "Płatowiec, elementy konstrukcyjne, podzespoły i instalacje.",
      },
      {
        title: "Silniki lotnicze",
        text: "Budowa, zasada działania i obsługa zespołów napędowych.",
      },
      {
        title: "Przeglądy techniczne",
        text: "Przeglądy statków powietrznych zgodnie z dokumentacją.",
      },
      { title: "Inspekcje", text: "Kontrola stanu podzespołów, instalacji i konstrukcji." },
      { title: "Naprawy i montaż", text: "Demontaż, montaż i naprawy elementów lotniczych." },
      { title: "Dokumentacja lotnicza", text: "Dokumentacja techniczna i procedury obsługowe." },
    ],
    tools: ["Płatowiec", "Silniki", "Hydraulika", "Układy paliwowe", "Mechanizmy", "Diagnostyka"],
    practice: [
      "Praktyczna obsługa elementów statków powietrznych",
      "Lotnictwo cywilne i wojskowe",
      "Staże i zagraniczne praktyki",
    ],
    exams: [
      {
        code: "TLO.07",
        name: "Obsługa techniczna statku powietrznego",
        scope:
          "Obsługa techniczna statku powietrznego, jego instalacji i zespołu napędowego. Uczniowie, którzy zaczęli naukę przed 1 września 2026 r., zdają dotychczasową kwalifikację TLO.03.",
      },
    ],
    careers: [
      { title: "Obsługa liniowa", text: "Obsługa techniczna samolotów bezpośrednio na lotnisku." },
      { title: "Obsługa hangarowa", text: "Przeglądy i naprawy wykonywane w hangarach." },
      {
        title: "General Aviation",
        text: "Samoloty, śmigłowce, szybowce i inne statki powietrzne.",
      },
      { title: "Przemysł lotniczy", text: "Produkcja, serwis i remonty statków powietrznych." },
    ],
    erasmus: true,
  },
  {
    slug: "technik-lotniskowych-sluzb-operacyjnych",
    profession: "technik-lotniskowych-sluzb-operacyjnych",
    school: "technikum",
    lead: "Poznajesz port lotniczy od strony, której pasażer nie widzi: obsługę samolotów, pasażerów i bagażu, koordynację operacji i bezpieczeństwo.",
    learn: [
      {
        title: "Pasażerowie i bagaż",
        text: "Organizacja obsługi pasażerów, bagażu i procesów w terminalu.",
      },
      {
        title: "Obsługa samolotu",
        text: "Naziemna obsługa statku powietrznego na stanowisku postojowym.",
      },
      {
        title: "Koordynacja rejsów",
        text: "Przygotowanie i koordynacja obsługi samolotu przed rejsem.",
      },
      { title: "Cargo i poczta", text: "Ładunki lotnicze, przesyłki i poczta." },
      { title: "Operacje lotniskowe", text: "Planowanie i koordynacja zasobów portu lotniczego." },
      {
        title: "Bezpieczeństwo lotnicze",
        text: "Procedury bezpieczeństwa i ochrona lotnictwa cywilnego.",
      },
    ],
    tools: ["Airside", "Landside", "Apron", "Operations", "Safety", "Security"],
    practice: [],
    exams: [
      {
        code: "TLO.05",
        name: "Obsługa naziemna statków powietrznych",
        scope:
          "Obsługa pasażerów, bagażu, statku powietrznego, rejsów i ładunków w porcie lotniczym.",
      },
      {
        code: "TLO.06",
        name: "Planowanie i koordynacja operacyjna",
        scope:
          "Planowanie i koordynacja operacyjna w porcie lotniczym oraz ochrona lotnictwa cywilnego. Uczniowie, którzy zaczęli naukę przed 1 września 2026 r., zdają dotychczasową kwalifikację TLO.02.",
      },
    ],
    careers: [
      { title: "Porty lotnicze", text: "Bieżąca obsługa operacyjna lotniska." },
      { title: "Obsługa naziemna", text: "Obsługa samolotów, pasażerów, bagażu i ładunków." },
      {
        title: "Koordynacja operacyjna",
        text: "Planowanie, przepływ informacji i koordynacja operacji.",
      },
      {
        title: "Bezpieczeństwo lotniska",
        text: "Bezpieczeństwo operacyjne i ochrona lotnictwa cywilnego.",
      },
    ],
    erasmus: false,
  },
];
