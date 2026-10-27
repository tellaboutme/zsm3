import { seedDatasets } from "@zsm3/worker/seed/datasets/index.ts";
import { describe, it } from "vitest";

import { privacyPolicy } from "../src/data/legal/privacy.ts";
import { buildSiteMap } from "../src/data/site-map.ts";
import { statusLabel } from "../src/lib/legal.ts";
import { flattenMap, mapHrefs } from "../src/lib/site-map.ts";

describe("site map", () => {
  it("lists every page once", ({ expect }) => {
    const hrefs = mapHrefs(
      buildSiteMap(
        [
          { path: "/szkola/historia", title: "Historia", intro: "Od 1950 roku." },
          { path: "/uczniowie/podreczniki", title: "Podręczniki", intro: "Wykazy." },
          { path: "/rodo", title: "RODO", intro: "Ochrona danych." },
        ],
        seedDatasets.kierunki,
      ),
    );

    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toContain("/kandydaci/zawody/technik-awionik");
    expect(hrefs).toContain("/aktualnosci");
    expect(hrefs).toContain("/polityka-prywatnosci");
    expect(hrefs).toContain("/szkola/historia");
    expect(hrefs).toContain("/uczniowie/podreczniki");
    expect(hrefs.indexOf("/rodo")).toBeGreaterThan(hrefs.indexOf("/kontakt"));
  });

  it("flattens nested nodes depth first", ({ expect }) => {
    const nodes = [
      { label: "A", href: "/a", children: [{ label: "B", href: "/b" }] },
      { label: "C", href: "/c" },
    ];

    expect(flattenMap(nodes).map((node) => node.label)).toEqual(["A", "B", "C"]);
  });
});

describe("legal documents", () => {
  it("label their status", ({ expect }) => {
    expect(statusLabel(privacyPolicy)).toBe("Dokument obowiązujący");
    expect(statusLabel({ ...privacyPolicy, status: "projekt" })).toBe(
      "Projekt do zatwierdzenia przez inspektora ochrony danych",
    );
  });
});
