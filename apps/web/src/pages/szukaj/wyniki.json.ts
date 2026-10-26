import { searchPage } from "../../server/search.ts";

export const prerender = false;

export async function GET({ url }: { url: URL }): Promise<Response> {
  return searchPage(url.searchParams);
}
