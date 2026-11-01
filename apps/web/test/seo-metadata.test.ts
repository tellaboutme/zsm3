import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { shouldNoindex, SITE_ORIGIN, SOCIAL_IMAGE } from "../src/lib/seo.ts";

type Kind = "title" | "description";

interface Field {
  readonly value: string;
  readonly literal: boolean;
}

interface Metadata {
  readonly route: string;
  readonly title: Field;
  readonly description: Field;
}

const PAGES = fileURLToPath(new URL("../src/pages", import.meta.url));
const IMAGE = fileURLToPath(new URL("../public/og-default.png", import.meta.url));
const CLOSED_ROUTES: readonly string[] = ["/panel", "/wzornik", "/s", "/e-wniosek"];
const KINDS: readonly Kind[] = ["title", "description"];
const SAMPLE_SEGMENTS: Readonly<Record<string, string>> = {
  "[section]": "szkola",
  "[page]": "2",
  "[year]": "2026",
  "[slug]": "przyklad",
  "[category]": "szkola",
  "[code]": "abc",
  "[...rest]": "kolory",
};

const LITERAL = /([A-Za-z][\w-]*)\s*=\s*"([^"]*)"/gu;
const EXPRESSION = /([A-Za-z][\w-]*)\s*=\s*\{/gu;
const FLAG = /\bnoindex\b/u;

function pageFiles(directory: string, prefix = ""): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      return pageFiles(join(directory, entry.name), relative);
    }
    return entry.name.endsWith(".astro") ? [relative] : [];
  });
}

function routeOf(file: string): string {
  const segments = file
    .replace(/\.astro$/u, "")
    .replace(/\/index$/u, "")
    .split("/")
    .map((segment) => SAMPLE_SEGMENTS[segment] ?? segment);
  const route = segments.join("/");
  return route === "" ? "/" : route;
}

function isClosed(route: string): boolean {
  return (
    CLOSED_ROUTES.some((closed) => route === closed || route.startsWith(`${closed}/`)) ||
    shouldNoindex(new URL(route, SITE_ORIGIN))
  );
}

function step(
  character: string,
  depth: number,
  quote: string | undefined,
): readonly [number, string | undefined] {
  if (quote !== undefined) {
    return [depth, character === quote ? undefined : quote];
  }
  if (character === '"' || character === "'" || character === "`") {
    return [depth, character];
  }
  if (character === "{") {
    return [depth + 1, undefined];
  }
  if (character === "}") {
    return [depth - 1, undefined];
  }
  return [depth, undefined];
}

function openTag(source: string): string | undefined {
  const start = source.indexOf("<Base");
  if (start === -1) {
    return undefined;
  }
  let state: readonly [number, string | undefined] = [0, undefined];
  for (let index = start + "<Base".length; index < source.length; index += 1) {
    const character = source[index] ?? "";
    if (character === ">" && state[0] === 0 && state[1] === undefined) {
      return source.slice(start, index);
    }
    state = step(character, state[0], state[1]);
  }
  return undefined;
}

function fields(tag: string): ReadonlyMap<string, Field> {
  const parsed = new Map<string, Field>();
  for (const match of tag.matchAll(EXPRESSION)) {
    parsed.set(match[1] ?? "", { value: "", literal: false });
  }
  for (const match of tag.matchAll(LITERAL)) {
    parsed.set(match[1] ?? "", { value: match[2] ?? "", literal: true });
  }
  if (FLAG.test(tag)) {
    parsed.set("noindex", { value: "", literal: false });
  }
  return parsed;
}

function metadataOf(source: string, route: string): Metadata | undefined {
  const tag = openTag(source);
  if (tag === undefined) {
    return undefined;
  }
  const parsed = fields(tag);
  const title = parsed.get("title");
  const description = parsed.get("description");
  if (title === undefined || description === undefined) {
    throw new Error(`${route} renders Base.astro without a title or description`);
  }
  return parsed.has("noindex") ? undefined : { route, title, description };
}

const pages = pageFiles(PAGES)
  .map((file) => ({ route: routeOf(file), source: readFileSync(join(PAGES, file), "utf8") }))
  .filter((entry) => !isClosed(entry.route))
  .flatMap((entry) => {
    const metadata = metadataOf(entry.source, entry.route);
    return metadata === undefined ? [] : [metadata];
  });

describe("page metadata", () => {
  it("indexes more than ten pages that fill a non-empty title and description", () => {
    expect(pages.length).toBeGreaterThan(10);

    const empty = pages.flatMap((page) =>
      KINDS.filter((kind) => {
        const field = page[kind];
        return field.literal && field.value.trim() === "";
      }).map((kind) => `${page.route} ${kind}`),
    );
    expect(empty).toEqual([]);
  });

  it("keeps literal titles and descriptions unique across pages", () => {
    const owners = new Map<string, string>();
    const duplicates: string[] = [];
    for (const page of pages) {
      for (const kind of KINDS) {
        const field = page[kind];
        if (!field.literal) {
          continue;
        }
        const key = `${kind}: ${field.value.trim().replace(/\s+/gu, " ").toLowerCase()}`;
        const owner = owners.get(key);
        if (owner === undefined) {
          owners.set(key, page.route);
        } else {
          duplicates.push(`${page.route} repeats the ${kind} of ${owner}`);
        }
      }
    }
    expect(duplicates).toEqual([]);
  });

  it("ships the social image at the declared size", () => {
    const image = readFileSync(IMAGE);

    expect(image.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(image.readUInt32BE(16)).toBe(SOCIAL_IMAGE.width);
    expect(image.readUInt32BE(20)).toBe(SOCIAL_IMAGE.height);
  });
});
