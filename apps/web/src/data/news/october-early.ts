import type { NewsItem } from "../../lib/news.ts";

export const octoberEarly: readonly NewsItem[] = [
  {
    slug: "jesienny-rajd-rowerowy",
    date: "2026-10-09",
    category: "Wychowanie fizyczne",
    title: "Jesienny rajd rowerowy po Krakowie",
    lead: "Dwie klasy przejechały trasę od Rynku Głównego przez Smoka Wawelskiego do Parku Jordana.",
    cover: { caption: "Uczestnicy rajdu w Parku Jordana" },
    body: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "W piątek 2 października uczniowie dwóch klas z nauczycielkami wychowania fizycznego wyruszyli na rajd po Krakowie. Rajd połączył aktywność fizyczną ze zwiedzaniem miasta.",
          },
        ],
      },
      {
        type: "list",
        ordered: true,
        items: [
          [{ type: "text", text: "Rynek Główny – start zwiedzania" }],
          [{ type: "text", text: "Smok Wawelski – pod Wawelem" }],
          [{ type: "text", text: "Park Jordana – meta rajdu" }],
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Wkrótce kolejna edycja szkolnego memoriału rowerowego – zapraszamy do śledzenia ogłoszeń.",
          },
        ],
      },
    ],
  },
  {
    slug: "tydzien-przeciwdzialania-przemocy-rowiesniczej",
    date: "2026-10-08",
    category: "Sport",
    title: "Sport przeciw przemocy",
    lead: "W Tygodniu Przeciwdziałania Przemocy Rówieśniczej 11 klas zagrało w siatkówkę, 30 osób w tenisa stołowego i 28 w badmintona.",
    body: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Turnieje odbyły się 1 października. Samym udziałem uczniowie pokazali sprzeciw wobec przemocy rówieśniczej i to, że rywalizacja fair play uczy szacunku i życzliwości.",
          },
        ],
      },
      {
        type: "table",
        caption: "Uczestnicy turniejów",
        header: ["Dyscyplina", "Forma", "Uczestnicy"],
        rows: [
          ["Piłka siatkowa", "drużyny klasowe", "11 klas"],
          ["Tenis stołowy", "turniej indywidualny", "30 osób"],
          ["Badminton", "turniej indywidualny", "28 osób"],
        ],
      },
    ],
  },
  {
    slug: "dzien-patrona-szkoly-i-slubowanie-klas-pierwszych",
    date: "2026-10-08",
    category: "Uroczystości",
    title: "Dzień Patrona Szkoły i ślubowanie klas pierwszych",
    lead: "23 października odbędzie się Dzień Patrona Szkoły i ślubowanie uczniów klas pierwszych. Oto harmonogram uroczystości.",
    body: [
      {
        type: "table",
        caption: "Harmonogram 23 października 2026",
        header: ["Godzina", "Punkt programu"],
        rows: [
          ["9:10", "Spotkanie wychowawców z klasami w salach, lekcja wychowawcza"],
          ["10:00", "Aula szkolna – apel i ślubowanie klas pierwszych"],
          ["10:20", "Spektakl dla klas pierwszych z okazji Dnia Patrona"],
          ["11:00", "Złożenie kwiatów przed pomnikiem gen. Władysława Sikorskiego"],
          ["11:10", "Część artystyczna przygotowana przez samorząd uczniowski"],
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Podstawa: zarządzenie dyrektora z 8 października 2026 r. Zobacz też ",
          },
          { type: "link", text: "terminarz roku szkolnego", href: "/szkola/terminarz" },
          { type: "text", text: "." },
        ],
      },
    ],
  },
];
