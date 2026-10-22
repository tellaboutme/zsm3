import { news } from "./news/index.ts";
import { contentPages } from "./pages/index.ts";
import { professions } from "./professions.ts";
import { programmes } from "./programmes/index.ts";
import {
  categoryHref,
  laterPages,
  NEWS_PAGE_SIZE,
  newsCategories,
  newsHref,
  newsYear,
  newsYears,
  pageHref,
} from "../lib/news.ts";
import { schoolLabels } from "../lib/professions.ts";
import { professionOf, programmeHref } from "../lib/programmes.ts";
import type { MapNode } from "../lib/site-map.ts";

function contentNodes(section: string): readonly MapNode[] {
  return contentPages
    .filter((page) => page.path.startsWith(`/${section}/`))
    .map((page) => ({ label: page.title, href: page.path, description: page.intro }));
}

function listingPages(base: string, total: number): readonly MapNode[] {
  return laterPages(total, NEWS_PAGE_SIZE).map((page) => ({
    label: `Strona ${String(page)}`,
    href: pageHref(base, page),
  }));
}

const programmeNodes: readonly MapNode[] = programmes.map((programme) => ({
  label: `${professionOf(professions, programme).name} (${schoolLabels[programme.school]})`,
  href: programmeHref(programme),
  description: programme.lead,
}));

const newsNodes: readonly MapNode[] = [
  ...listingPages("/aktualnosci", news.length),
  ...newsCategories(news).map((category) => {
    const items = news.filter((item) => item.category === category.name);
    return {
      label: `Kategoria: ${category.name}`,
      href: categoryHref(category),
      children: listingPages(categoryHref(category), items.length),
    };
  }),
  ...newsYears(news).map((year) => ({
    label: `Rok ${year}`,
    href: `/aktualnosci/${year}`,
    children: [
      ...listingPages(
        `/aktualnosci/${year}`,
        news.filter((item) => newsYear(item) === year).length,
      ),
      ...news
        .filter((item) => newsYear(item) === year)
        .map((item) => ({ label: item.title, href: newsHref(item), description: item.lead })),
    ],
  })),
];

export const siteMap: readonly MapNode[] = [
  {
    label: "Strona główna",
    href: "/",
    description:
      "Technikum i szkoła branżowa w Nowej Hucie: zawody, dzwonki, aktualności i terminarz.",
  },
  {
    label: "Kandydaci",
    href: "/kandydaci",
    children: [
      {
        label: "Zawody i kierunki",
        href: "/kandydaci/zawody",
        description: "15 kierunków w technikum oraz branżowej szkole I i II stopnia.",
        children: programmeNodes,
      },
    ],
  },
  {
    label: "Uczniowie",
    href: "/uczniowie",
    children: [
      {
        label: "Dzwonki",
        href: "/uczniowie/dzwonki",
        description: "Godziny lekcji i przerw oraz dni ze skróconymi lekcjami.",
      },
      {
        label: "Wzory dokumentów",
        href: "/uczniowie/wzory-dokumentow",
        description: "Formularze PDF: duplikaty, zwolnienia, wydanie dokumentów, oświadczenia.",
      },
    ],
  },
  {
    label: "Rodzice",
    href: "/rodzice",
    children: [
      {
        label: "Wywiadówki",
        href: "/rodzice/wywiadowki",
        description: "Terminy zebrań z rodzicami i sale klas.",
      },
    ],
  },
  {
    label: "Szkoła",
    href: "/szkola",
    children: [
      ...contentNodes("szkola"),
      {
        label: "Kadra",
        href: "/szkola/kadra",
        description: "Dyrekcja, specjaliści i nauczyciele przedmiotów.",
      },
      {
        label: "Terminarz",
        href: "/szkola/terminarz",
        description: "Najważniejsze daty roku szkolnego 2026/2027.",
      },
    ],
  },
  { label: "Aktualności", href: "/aktualnosci", children: newsNodes },
  {
    label: "Kontakt",
    href: "/kontakt",
    description: "Sekretariaty, księgowość, Rada Rodziców i kierownictwo szkoły.",
  },
  {
    label: "Informacje o serwisie",
    href: "/mapa-strony",
    children: [
      {
        label: "Wyszukiwarka",
        href: "/szukaj",
        description: "Szukaj stron, kierunków i dokumentów.",
      },
      {
        label: "Polityka prywatności",
        href: "/polityka-prywatnosci",
        description: "Jakie dane przetwarza serwis szkoły i dlaczego.",
      },
    ],
  },
];
