import { professions } from "./professions.ts";
import { programmes } from "./programmes/index.ts";
import { schoolLabels } from "../lib/professions.ts";
import { professionOf, programmeHref } from "../lib/programmes.ts";
import type { MapNode } from "../lib/site-map.ts";

export interface MapPage {
  readonly path: string;
  readonly title: string;
  readonly intro: string;
}

function pageNode(page: MapPage): MapNode {
  return { label: page.title, href: page.path, description: page.intro };
}

function contentNodes(pages: readonly MapPage[], section: string): readonly MapNode[] {
  return pages.filter((page) => page.path.startsWith(`/${section}/`)).map(pageNode);
}

function topLevelNodes(pages: readonly MapPage[]): readonly MapNode[] {
  return pages.filter((page) => page.path.split("/").length === 2).map(pageNode);
}

const programmeNodes: readonly MapNode[] = programmes.map((programme) => ({
  label: `${professionOf(professions, programme).name} (${schoolLabels[programme.school]})`,
  href: programmeHref(programme),
  description: programme.lead,
}));

const baseMap: readonly MapNode[] = [
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
  {
    label: "Aktualności",
    href: "/aktualnosci",
    description: "Wydarzenia, konkursy, projekty i ogłoszenia z podziałem na kategorie i lata.",
  },
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

const SECTION_ROOTS: ReadonlySet<string> = new Set([
  "/kandydaci",
  "/uczniowie",
  "/rodzice",
  "/szkola",
]);

export function buildSiteMap(pages: readonly MapPage[]): readonly MapNode[] {
  const withPages = baseMap.map((node) =>
    SECTION_ROOTS.has(node.href)
      ? {
          ...node,
          children: [...contentNodes(pages, node.href.slice(1)), ...(node.children ?? [])],
        }
      : node,
  );
  return [...withPages.slice(0, -1), ...topLevelNodes(pages), ...withPages.slice(-1)];
}
