import { searchIndex } from "../../data/search-index.ts";

export function GET(): Response {
  return new Response(JSON.stringify(searchIndex), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
