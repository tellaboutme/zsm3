import { schoolYearEvents } from "./calendar/index.ts";
import { documentGroups } from "./documents.ts";
import { professions } from "./professions.ts";
import { programmes } from "./programmes/index.ts";
import { siteMap } from "./site-map.ts";
import { longDate } from "../lib/calendar.ts";
import { schoolLabels } from "../lib/professions.ts";
import { examCodes, professionOf, programmeHref } from "../lib/programmes.ts";
import type { SearchEntry } from "../lib/search.ts";
import { flattenMap } from "../lib/site-map.ts";

const PROGRAMME_OR_ARTICLE = /^\/(?:kandydaci\/zawody\/|aktualnosci\/\d{4}\/(?!strona\/))/u;

const pages: readonly SearchEntry[] = flattenMap(siteMap).flatMap((node) =>
  node.description === undefined || PROGRAMME_OR_ARTICLE.test(node.href)
    ? []
    : [{ type: "strona", title: node.label, href: node.href, text: node.description }],
);

const programmeEntries: readonly SearchEntry[] = programmes.map((programme) => {
  const profession = professionOf(professions, programme);
  return {
    type: "kierunek",
    title: `${profession.name} (${schoolLabels[programme.school]})`,
    href: programmeHref(programme),
    text: [programme.lead, profession.topics.join(" "), examCodes(programme)].join(" "),
  };
});

const documentEntries: readonly SearchEntry[] = documentGroups.flatMap((group) =>
  group.documents.map((document) => ({
    type: "dokument",
    title: `${document.code}: ${document.title}`,
    href: `/uczniowie/wzory-dokumentow#${group.id}`,
    text: `${group.title} ${document.description}`,
  })),
);

const eventEntries: readonly SearchEntry[] = schoolYearEvents.map((event) => ({
  type: "termin",
  title: event.title,
  href: "/szkola/terminarz",
  text: [longDate(event.date), event.note ?? "", event.audience].join(" "),
}));

export const staticSearchEntries: readonly SearchEntry[] = [
  ...pages,
  ...programmeEntries,
  ...documentEntries,
  ...eventEntries,
];
