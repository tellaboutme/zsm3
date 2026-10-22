const READ_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD"]);

export function isReadMethod(method: string): boolean {
  return READ_METHODS.has(method);
}

export function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: { Allow: [...READ_METHODS].join(", ") } });
}
