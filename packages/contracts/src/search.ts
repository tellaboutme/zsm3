import { z } from "zod";

export const searchKindSchema = z.enum(["aktualnosc", "strona"]);

export type SearchKind = z.infer<typeof searchKindSchema>;

export const resultTypeSchema = z.enum([
  "strona",
  "kierunek",
  "klasa",
  "kontakt",
  "aktualnosc",
  "dokument",
  "termin",
]);

export type ResultType = z.infer<typeof resultTypeSchema>;

export interface SearchDocument {
  readonly docId: string;
  readonly kind: SearchKind;
  readonly href: string;
  readonly title: string;
  readonly body: string;
  readonly publishedOn: string | null;
}

export const searchQuerySchema = z.string().trim().min(2).max(200);

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchTextMaxLength = 20000;

const resultHref = z
  .string()
  .max(500)
  .regex(/^\/\S*$/u);

export const searchResultSchema = z.strictObject({
  type: resultTypeSchema,
  title: z.string().min(1).max(200),
  href: resultHref,
  text: z.string().max(searchTextMaxLength),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z.strictObject({
  results: z.array(searchResultSchema).max(50),
  suggestion: z.string().min(2).max(200).optional(),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;
