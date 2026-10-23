import { regularSchedule } from "./bell-schedule.ts";
import { schoolYearEvents } from "./calendar/index.ts";
import { departments, management } from "./contacts.ts";
import { documentGroups } from "./documents.ts";
import { gradeRooms, meetingPlan } from "./meetings.ts";
import { professions } from "./professions.ts";
import { programmes } from "./programmes/index.ts";
import { buildSiteMap } from "./site-map.ts";
import { staffGroups } from "./staff.ts";
import { longDate } from "../lib/calendar.ts";
import { schoolLabels } from "../lib/professions.ts";
import { examCodes, professionOf, programmeFaq, programmeHref } from "../lib/programmes.ts";
import { bellsEntry, classEntries, contactEntry, staffEntry } from "../lib/search-sources.ts";
import type { SearchEntry } from "../lib/search.ts";
import { flattenMap } from "../lib/site-map.ts";

const PROGRAMME_OR_ARTICLE = /^\/(?:kandydaci\/zawody\/|aktualnosci\/\d{4}\/(?!strona\/))/u;
const INDEXED_SEPARATELY = new Set(["/uczniowie/dzwonki"]);

const pages: readonly SearchEntry[] = flattenMap(buildSiteMap([])).flatMap((node) =>
  node.description === undefined ||
  PROGRAMME_OR_ARTICLE.test(node.href) ||
  INDEXED_SEPARATELY.has(node.href)
    ? []
    : [{ type: "strona", title: node.label, href: node.href, text: node.description }],
);

const programmeEntries: readonly SearchEntry[] = programmes.map((programme) => {
  const profession = professionOf(professions, programme);
  const topics = [...programme.learn, ...programme.careers].map(
    (topic) => `${topic.title} ${topic.text}`,
  );
  const faq = programmeFaq(programme, profession).map((item) => `${item.question} ${item.answer}`);
  return {
    type: "kierunek",
    title: `${profession.name} (${schoolLabels[programme.school]})`,
    href: programmeHref(programme),
    text: [
      programme.lead,
      examCodes(programme),
      profession.topics.join(" "),
      ...topics,
      programme.tools.join(" "),
      ...programme.practice,
      ...faq,
    ].join(" "),
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
  bellsEntry(regularSchedule),
  ...programmeEntries,
  ...classEntries(gradeRooms, longDate(meetingPlan.date)),
  ...[...departments, ...management].map(contactEntry),
  ...staffGroups.map(staffEntry),
  ...documentEntries,
  ...eventEntries,
];
