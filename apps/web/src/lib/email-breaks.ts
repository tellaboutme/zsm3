export function emailSegments(email: string): readonly string[] {
  const at = email.indexOf("@");
  if (at < 0) {
    return [email];
  }
  const domain = email.slice(at + 1).split(/(?=\.)/u);
  return [email.slice(0, at + 1), ...domain];
}
