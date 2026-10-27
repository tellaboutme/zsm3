import type { Profession } from "@zsm3/contracts/programmes";

const technikum = { school: "technikum", years: 5 } as const;
const branzowaFirst = { school: "branzowa-1", years: 3 } as const;
const branzowaSecond = { school: "branzowa-2", years: 2 } as const;

export const professions: readonly Profession[] = [
  {
    slug: "technik-informatyk",
    name: "Technik informatyk",
    field: "informatyka",
    topics: ["systemy komputerowe", "sieci", "serwery", "bazy danych"],
    qualifications: [
      { code: "INF.02", name: "Systemy, sprzęt i sieci" },
      { code: "INF.03", name: "Strony WWW i bazy danych" },
    ],
    paths: [technikum],
  },
  {
    slug: "technik-programista",
    name: "Technik programista",
    field: "informatyka",
    topics: ["programowanie", "aplikacje", "SQL", "testowanie"],
    qualifications: [
      { code: "INF.03", name: "Strony WWW i bazy danych" },
      { code: "INF.04", name: "Projektowanie i programowanie aplikacji" },
    ],
    paths: [technikum],
  },
  {
    slug: "technik-robotyk",
    name: "Technik robotyk",
    field: "mechatronika",
    topics: ["roboty", "programowanie", "uruchamianie", "serwis"],
    qualifications: [
      { code: "ELM.07", name: "Montaż i uruchamianie systemów robotyki" },
      { code: "ELM.08", name: "Programowanie systemów robotyki" },
    ],
    paths: [technikum],
  },
  {
    slug: "technik-mechatronik",
    name: "Technik mechatronik",
    field: "mechatronika",
    topics: ["pneumatyka", "hydraulika", "elektronika", "sterowniki PLC"],
    qualifications: [
      { code: "ELM.03", name: "Montaż i uruchamianie" },
      { code: "ELM.06", name: "Eksploatacja i programowanie" },
    ],
    paths: [technikum],
  },
  {
    slug: "technik-pojazdow-samochodowych",
    name: "Technik pojazdów samochodowych",
    field: "motoryzacja",
    topics: ["diagnostyka", "obsługa", "naprawa", "organizacja serwisu"],
    qualifications: [
      { code: "MOT.05", name: "Mechanika samochodowa" },
      { code: "MOT.06", name: "Organizacja obsługi pojazdów" },
    ],
    paths: [technikum, branzowaSecond],
  },
  {
    slug: "technik-elektromobilnosci",
    name: "Technik elektromobilności",
    field: "motoryzacja",
    topics: ["napędy elektryczne", "baterie", "pojazdy hybrydowe"],
    qualifications: [
      { code: "MOT.02", name: "Mechatronika samochodowa" },
      { code: "MOT.07", name: "Pojazdy zero- i niskoemisyjne" },
    ],
    paths: [technikum, branzowaSecond],
  },
  {
    slug: "mechanik-pojazdow-samochodowych",
    name: "Mechanik pojazdów samochodowych",
    field: "motoryzacja",
    topics: ["przeglądy", "diagnostyka", "naprawa", "prawo jazdy kat. B"],
    qualifications: [{ code: "MOT.05", name: "Obsługa i naprawa pojazdów" }],
    paths: [branzowaFirst],
  },
  {
    slug: "elektromechanik-pojazdow-samochodowych",
    name: "Elektromechanik pojazdów samochodowych",
    field: "motoryzacja",
    topics: ["diagnostyka komputerowa", "instalacje", "czujniki", "prawo jazdy kat. B"],
    qualifications: [{ code: "MOT.02", name: "Systemy mechatroniczne pojazdów" }],
    paths: [branzowaFirst],
  },
  {
    slug: "mechanik-motocyklowy",
    name: "Mechanik motocyklowy",
    field: "motoryzacja",
    topics: ["diagnostyka", "serwis", "naprawa", "prawo jazdy kat. A"],
    qualifications: [{ code: "MOT.04", name: "Obsługa i naprawa motocykli" }],
    paths: [branzowaFirst],
  },
  {
    slug: "technik-awionik",
    name: "Technik awionik",
    field: "lotnictwo",
    topics: ["awionika", "elektronika", "instalacje", "systemy statku powietrznego"],
    qualifications: [{ code: "TLO.01", name: "Obsługa wyposażenia statków powietrznych" }],
    paths: [technikum],
  },
  {
    slug: "technik-mechanik-lotniczy",
    name: "Technik mechanik lotniczy",
    field: "lotnictwo",
    topics: ["płatowiec", "silniki", "przeglądy", "obsługa techniczna"],
    qualifications: [{ code: "TLO.07", name: "Obsługa techniczna statków powietrznych" }],
    paths: [technikum],
  },
  {
    slug: "technik-lotniskowych-sluzb-operacyjnych",
    name: "Technik lotniskowych służb operacyjnych",
    field: "lotnictwo",
    topics: ["airside", "operacje naziemne", "koordynacja", "bezpieczeństwo"],
    qualifications: [
      { code: "TLO.05", name: "Obsługa naziemna statków powietrznych" },
      { code: "TLO.06", name: "Planowanie i koordynacja operacyjna" },
    ],
    paths: [technikum],
  },
  {
    slug: "technik-eksploatacji-portow-i-terminali",
    name: "Technik eksploatacji portów i terminali",
    field: "logistyka",
    topics: ["terminale", "pasażerowie", "cargo", "logistyka"],
    qualifications: [
      { code: "SPL.02", name: "Obsługa podróżnych" },
      { code: "SPL.03", name: "Obsługa ładunków" },
    ],
    paths: [technikum],
  },
];
