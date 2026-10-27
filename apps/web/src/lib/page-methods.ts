const READ_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD"]);

export function isReadMethod(method: string): boolean {
  return READ_METHODS.has(method);
}

export function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: { Allow: [...READ_METHODS].join(", ") } });
}

export function isSitePage(path: string): boolean {
  const panel = path === "/panel" || path.startsWith("/panel/");
  const lastSegment = path.slice(path.lastIndexOf("/") + 1);
  return !panel && !lastSegment.includes(".");
}
