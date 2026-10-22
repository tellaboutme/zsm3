import type { News } from "@zsm3/contracts/content";

export const september: readonly News[] = [
  {
    slug: "ogolnopolski-dzien-glosnego-czytania",
    date: "2026-09-29",
    category: "Biblioteka",
    title: "Młodzi lektorzy w bibliotece szkolnej",
    lead: "W Ogólnopolski Dzień Głośnego Czytania uczniowie z samorządu czytali przedszkolakom w szkolnej bibliotece.",
    body: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Uczniowie wcielili się w lektorów i zabrali małych gości w świat historii pełnych przygód. Głośne czytanie to okazja do:",
          },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [
          [{ type: "text", text: "rozwijania wyobraźni," }],
          [{ type: "text", text: "wzbogacania słownictwa," }],
          [{ type: "text", text: "uważnego słuchania," }],
          [{ type: "text", text: "rozbudzania ciekawości świata." }],
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Na koniec dzieci z pomocą uczniów zrobiły własne zakładki do książek.",
          },
        ],
      },
    ],
  },
  {
    slug: "roboty-przemyslowe-i-nowy-sprzet-dla-szkol",
    date: "2026-09-25",
    category: "Centrum Kompetencji Zawodowych",
    title: "Roboty przemysłowe i nowy sprzęt dla krakowskich szkół",
    lead: "W projekcie Centrum Kompetencji Zawodowych 593 uczniów z krakowskich szkół odbyło płatne staże, a szkoły dostały sprzęt za ponad 3,7 mln zł.",
    body: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Projekt jest dofinansowany z programu Fundusze Europejskie dla Małopolski 2021–2027 i prowadzony przez Miejskie Centrum Obsługi Oświaty w Krakowie razem ze szkołami.",
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
              text: "593 uczniów z 16 szkół zawodowych odbyło 140-godzinne staże w wakacje.",
            },
          ],
          [{ type: "text", text: "Stypendium stażowe wyniosło 3 102,40 zł na osobę." }],
          [{ type: "text", text: "Roboty przemysłowe kupiono za 814 322,25 zł." }],
          [{ type: "text", text: "Łączna wartość projektu to 24,56 mln zł." }],
        ],
      },
    ],
  },
  {
    slug: "zajrzyj-do-huty-2026",
    date: "2026-09-24",
    category: "Wydarzenia",
    title: "Zajrzyj do Huty: szkoła, która łączy pokolenia",
    lead: "19 i 20 września szkoła otworzyła drzwi dla gości wydarzenia organizowanego przez Muzeum Nowej Huty.",
    cover: { caption: "Samochody z czasów PRL przed budynkiem szkoły" },
    body: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Przed szkołą stanęły samochody i motocykle z czasów PRL, a uczniowie z samorządu oprowadzali gości po pracowniach.",
          },
        ],
      },
      { type: "heading", level: 2, text: "Otwarte pracownie" },
      {
        type: "list",
        ordered: true,
        items: [
          [{ type: "text", text: "Pracownia samochodowa" }],
          [{ type: "text", text: "Pracownia druku 3D" }],
          [{ type: "text", text: "Pracownia silników lotniczych z symulatorem lotów" }],
        ],
      },
    ],
  },
  {
    slug: "salon-maturzystow-2026",
    date: "2026-09-22",
    category: "Technikum",
    title: "Salon Maturzystów Perspektywy 2026",
    lead: "Klasy piąte technikum poznały oferty uczelni i wysłuchały wykładów o egzaminie maturalnym.",
    body: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "21 i 22 września uczniowie wzięli udział w 20. Salonie Maturzystów na Uniwersytecie Jagiellońskim przy ul. Krupniczej 33. Rozmawiali z przedstawicielami uczelni z całej Polski i słuchali wykładów o maturze.",
          },
        ],
      },
    ],
  },
];
