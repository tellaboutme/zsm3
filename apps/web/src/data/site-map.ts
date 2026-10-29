import type { Programmes } from "@zsm3/contracts/programmes";

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

function programmeNodes({ professions, programmes }: Programmes): readonly MapNode[] {
  return programmes.map((programme) => ({
    label: `${professionOf(professions, programme).name} (${schoolLabels[programme.school]})`,
    href: programmeHref(programme),
    description: programme.lead,
  }));
}

const BASE_MAP: readonly MapNode[] = [
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
      },
      {
        label: "Szkoła w obiektywie",
        href: "/kandydaci/szkola-w-obiektywie",
        description: "Budynek, warsztaty i pracownie zawodowe oczami kandydata.",
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
      {
        label: "E-wniosek",
        href: "/e-wniosek",
        description: "Złóż wniosek o dokument szkolny lub sprawdź stan wcześniejszego wniosku.",
      },
      {
        label: "Stan wniosku",
        href: "/e-wniosek/status",
        description: "Sprawdź stan złożonego wniosku o dokument szkolny.",
      },
      {
        label: "Oferty pracy",
        href: "/uczniowie/oferty-pracy",
        description: "Oferty pracy, staży i praktyk od pracodawców współpracujących ze szkołą.",
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
      {
        label: "Galeria",
        href: "/szkola/galeria",
        description: "Galeria nie zawiera obecnie opublikowanych zdjęć.",
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

const PROGRAMMES_HREF = "/kandydaci/zawody";

function withProgrammes(nodes: readonly MapNode[], kierunki: Programmes): readonly MapNode[] {
  return nodes.map((node) => {
    if (node.href === PROGRAMMES_HREF) {
      return { ...node, children: programmeNodes(kierunki) };
    }
    return node.children === undefined
      ? node
      : { ...node, children: withProgrammes(node.children, kierunki) };
  });
}

export function buildSiteMap(pages: readonly MapPage[], kierunki: Programmes): readonly MapNode[] {
  const withPages = withProgrammes(BASE_MAP, kierunki).map((node) =>
    SECTION_ROOTS.has(node.href)
      ? {
          ...node,
          children: [...contentNodes(pages, node.href.slice(1)), ...(node.children ?? [])],
        }
      : node,
  );
  return [...withPages.slice(0, -1), ...topLevelNodes(pages), ...withPages.slice(-1)];
}
