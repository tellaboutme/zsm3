export function withQueryNoindex(request: Request, response: Response): Response {
  if (
    new URL(request.url).search === "" ||
    response.status >= 300 ||
    response.headers.get("Content-Type")?.toLowerCase().startsWith("text/html") !== true
  ) {
    return response;
  }
  const result = new Response(response.body, response);
  result.headers.set("X-Robots-Tag", "noindex, follow");
  return result;
}
