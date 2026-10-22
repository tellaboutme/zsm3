import type { NewsItem } from "../../lib/news.ts";

export const octoberLate: readonly NewsItem[] = [
  {
    slug: "kurs-programowania-robotow-przemyslowych",
    date: "2026-10-19",
    category: "Centrum Kompetencji Zawodowych",
    title: "Ruszył kurs programowania robotów przemysłowych",
    lead: "12 października uczniowie zaczęli kurs w ramach 3. edycji projektu Centrum Kompetencji Zawodowych, współfinansowanego przez Unię Europejską.",
    cover: { caption: "Zajęcia z programowania robota przemysłowego" },
    body: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Kurs to kolejna okazja do zdobycia praktycznych umiejętności, których szukają pracodawcy. Uczniowie poznają programowanie i obsługę robotów przemysłowych na sprzęcie kupionym w ramach projektu.",
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Projekt: " },
          {
            type: "text",
            text: "Centrum Kompetencji Zawodowych w Gminie Miejskiej Kraków – 3 edycja",
            marks: ["bold"],
          },
          { type: "text", text: ". Więcej o kierunku: " },
          { type: "link", text: "technik robotyk", href: "/kandydaci/zawody/technik-robotyk" },
          { type: "text", text: "." },
        ],
      },
    ],
  },
  {
    slug: "swiatowy-dzien-przywracania-czynnosci-serca",
    date: "2026-10-17",
    category: "Zdrowie",
    title: "Warsztaty pierwszej pomocy",
    lead: "Z okazji Światowego Dnia Przywracania Czynności Serca uczniowie ćwiczyli resuscytację krążeniowo-oddechową i reagowanie w sytuacji zagrożenia życia.",
    cover: { caption: "Ćwiczenia resuscytacji na fantomie" },
    body: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Uczniowie klasy pierwszej zdobyli wiedzę i praktyczne umiejętności z trzech obszarów:",
          },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [
          [{ type: "text", text: "resuscytacja krążeniowo-oddechowa w praktyce," }],
          [{ type: "text", text: "właściwa reakcja w sytuacji zagrożenia życia," }],
          [{ type: "text", text: "pomoc osobie poszkodowanej." }],
        ],
      },
      { type: "heading", level: 2, text: "Pamiętaj" },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Numery alarmowe: " },
          { type: "link", text: "112", href: "tel:112" },
          { type: "text", text: " oraz " },
          { type: "link", text: "999", href: "tel:999" },
          {
            type: "text",
            text: ". Przy resuscytacji uciskamy klatkę piersiową w rytmie 30 uciśnięć na 2 oddechy. Każda minuta bez pomocy zmniejsza szanse poszkodowanego.",
          },
        ],
      },
    ],
  },
  {
    slug: "konkurs-bogdan-wlosik-i-jego-nowohucka-mala-ojczyzna",
    date: "2026-10-15",
    category: "Konkursy",
    title: "II miejsce w konkursie o historii Nowej Huty",
    lead: "Uczniowie klasy piątej technikum zajęli II miejsce w konkursie historycznym „Bogdan Włosik i Jego Nowohucka Mała Ojczyzna”.",
    body: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Konkurs pogłębiał wiedzę o historii Nowej Huty, jej dziedzictwie i postaci Bogdana Włosika – młodego robotnika, ważnej postaci walki o wolność i prawa człowieka w Polsce.",
          },
        ],
      },
      {
        type: "quote",
        content: [
          {
            type: "text",
            text: "Gratulujemy zdobycia drugiego miejsca i życzymy kolejnych sukcesów oraz rozwijania pasji historycznych.",
          },
        ],
        source: "Społeczność ZSM3",
      },
    ],
  },
  {
    slug: "druzyna-mistrzow",
    date: "2026-10-11",
    category: "Wychowanie",
    title: "Warsztaty „Wdzięczni Weteranom”",
    lead: "Drużyna Mistrzów poprowadziła w szkole warsztaty o patriotyzmie, szacunku i odpowiedzialności, z muzyką na żywo.",
    body: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Warsztaty są częścią ogólnopolskiego cyklu współfinansowanego przez Ministerstwo Obrony Narodowej. Goście połączyli edukację historyczną z muzyką i profilaktyką.",
          },
        ],
      },
      { type: "heading", level: 2, text: "O czym rozmawialiśmy" },
      {
        type: "list",
        ordered: true,
        items: [
          [{ type: "text", text: "Historia: dzieje Polski i bohaterowie narodowi." }],
          [{ type: "text", text: "Służba: misje zagraniczne i bezpieczeństwo kraju." }],
          [{ type: "text", text: "Profilaktyka: hejt, przemoc i cyberprzemoc wśród młodzieży." }],
        ],
      },
    ],
  },
];
