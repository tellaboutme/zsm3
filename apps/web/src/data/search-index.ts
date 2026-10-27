import type { Programmes } from "@zsm3/contracts/programmes";

import { regularSchedule } from "./bell-schedule.ts";
import { buildSiteMap } from "./site-map.ts";
import { schoolLabels } from "../lib/professions.ts";
import { examCodes, professionOf, programmeFaq, programmeHref } from "../lib/programmes.ts";
import { bellsEntry } from "../lib/search-sources.ts";
import type { SearchEntry } from "../lib/search.ts";
import { flattenMap } from "../lib/site-map.ts";

const PROGRAMME_OR_ARTICLE = /^\/(?:kandydaci\/zawody\/|aktualnosci\/\d{4}\/(?!strona\/))/u;
const INDEXED_SEPARATELY = new Set(["/uczniowie/dzwonki"]);

function pageEntries(kierunki: Programmes): readonly SearchEntry[] {
  return flattenMap(buildSiteMap([], kierunki)).flatMap((node) =>
    node.description === undefined ||
    PROGRAMME_OR_ARTICLE.test(node.href) ||
    INDEXED_SEPARATELY.has(node.href)
      ? []
      : [{ type: "strona", title: node.label, href: node.href, text: node.description }],
  );
}

function programmeEntries({ professions, programmes }: Programmes): readonly SearchEntry[] {
  return programmes.map((programme) => {
    const profession = professionOf(professions, programme);
    const topics = [...programme.learn, ...programme.careers].map(
      (topic) => `${topic.title} ${topic.text}`,
    );
    const faq = programmeFaq(programme, profession).map(
      (item) => `${item.question} ${item.answer}`,
    );
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
}

export function baseSearchEntries(kierunki: Programmes): readonly SearchEntry[] {
  return [...pageEntries(kierunki), bellsEntry(regularSchedule), ...programmeEntries(kierunki)];
}
