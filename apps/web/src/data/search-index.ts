import { plainText } from "@zsm3/contracts/rich-text";

import { schoolYearEvents } from "./calendar/index.ts";
import { documentGroups } from "./documents.ts";
import { news } from "./news/index.ts";
import { professions } from "./professions.ts";
import { programmes } from "./programmes/index.ts";
import { siteMap } from "./site-map.ts";
import { longDate } from "../lib/calendar.ts";
import { newsHref } from "../lib/news.ts";
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

const newsEntries: readonly SearchEntry[] = news.map((item) => ({
  type: "aktualnosc",
  title: item.title,
  href: newsHref(item),
  text: `${item.category} ${item.lead} ${plainText(item.body)}`,
}));

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

export const searchIndex: readonly SearchEntry[] = [
  ...pages,
  ...programmeEntries,
  ...newsEntries,
  ...documentEntries,
  ...eventEntries,
];
