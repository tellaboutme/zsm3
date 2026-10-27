import { describe, it } from "vitest";

import {
  datasetKeySchema,
  datasetSchemas,
  jobOffersSchema,
  partnersSchema,
} from "../src/datasets.ts";
import { navigationSchema } from "../src/navigation.ts";
import { programmesSchema } from "../src/programmes.ts";

const PROFESSION = {
  slug: "technik-informatyk",
  name: "Technik informatyk",
  field: "informatyka",
  topics: ["sieci"],
  qualifications: [{ code: "INF.02", name: "Systemy" }],
  paths: [{ school: "technikum", years: 5 }],
};

const PROGRAMME = {
  slug: "technik-informatyk",
  profession: "technik-informatyk",
  school: "technikum",
  lead: "Sieci i serwery.",
  learn: [{ title: "Sieci", text: "LAN." }],
  tools: [],
  practice: [],
  exams: [],
  careers: [],
  erasmus: false,
};

function issue(result: {
  success: boolean;
  error?: { issues: { message: string; path: PropertyKey[] }[] };
}): unknown {
  return result.success
    ? undefined
    : { message: result.error?.issues[0]?.message, path: result.error?.issues[0]?.path };
}

describe("datasets", () => {
  it("names a schema for every dataset key", ({ expect }) => {
    expect(Object.keys(datasetSchemas).toSorted()).toEqual(
      [...datasetKeySchema.options].toSorted(),
    );
  });

  it("accepts site and https links for partners", ({ expect }) => {
    expect(partnersSchema.safeParse([{ name: "A", role: "B", href: "/kontakt" }]).success).toBe(
      true,
    );
    expect(
      partnersSchema.safeParse([{ name: "A", role: "B", href: "https://krakow.pl" }]).success,
    ).toBe(true);
    expect(
      partnersSchema.safeParse([{ name: "A", role: "B", href: "http://krakow.pl" }]).success,
    ).toBe(false);
  });

  it("links job offers only to stored media", ({ expect }) => {
    const offer = { employer: "A", position: "B", validUntil: "2026-12-31" };
    const file = { href: `/media/d/${"a".repeat(64)}.pdf`, bytes: 10 };
    expect(jobOffersSchema.safeParse([{ ...offer, file }]).success).toBe(true);
    expect(
      jobOffersSchema.safeParse([{ ...offer, file: { ...file, href: "/plik.pdf" } }]).success,
    ).toBe(false);
  });
});

describe("programmes", () => {
  it("accepts programmes of listed professions", ({ expect }) => {
    expect(
      programmesSchema.safeParse({ professions: [PROFESSION], programmes: [PROGRAMME] }).success,
    ).toBe(true);
  });

  it("explains duplicated or unknown references", ({ expect }) => {
    expect(
      issue(
        programmesSchema.safeParse({
          professions: [PROFESSION, PROFESSION],
          programmes: [PROGRAMME],
        }),
      ),
    ).toEqual({
      message: "Profession addresses are unique",
      path: ["professions"],
    });
    expect(
      issue(
        programmesSchema.safeParse({
          professions: [PROFESSION],
          programmes: [PROGRAMME, PROGRAMME],
        }),
      ),
    ).toEqual({
      message: "Programme addresses are unique",
      path: ["programmes"],
    });
    expect(
      issue(
        programmesSchema.safeParse({
          professions: [PROFESSION],
          programmes: [{ ...PROGRAMME, profession: "inny" }],
        }),
      ),
    ).toEqual({ message: "Programmes belong to listed professions", path: ["programmes"] });
  });
});

describe("navigation", () => {
  const section = { id: "kontakt", label: "Kontakt", href: "/kontakt", groups: [] };
  const withLink = (href: string): boolean =>
    navigationSchema.safeParse({
      sections: [section],
      utilityLinks: [{ label: "A", href }],
      footerGroups: [],
    }).success;

  it("accepts site paths, fragments and https links", ({ expect }) => {
    expect(withLink("/kandydaci/zawody#technikum")).toBe(true);
    expect(withLink("/")).toBe(true);
    expect(withLink("https://portal.librus.pl/rodzina")).toBe(true);
  });

  it("refuses other links with an explanation", ({ expect }) => {
    expect(withLink("javascript:alert(1)")).toBe(false);
    expect(withLink("x/kontakt")).toBe(false);
    expect(withLink("/kontakt x")).toBe(false);
    expect(withLink("https://a b")).toBe(false);
    expect(
      issue(
        navigationSchema.safeParse({
          sections: [section],
          utilityLinks: [{ label: "A", href: "ftp://x" }],
          footerGroups: [],
        }),
      ),
    ).toEqual({
      message: "A link points to a site path, a fragment of one, or an https address",
      path: ["utilityLinks", 0, "href"],
    });
  });
});
