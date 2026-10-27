import { STAFF_ROLE_LABELS } from "./staff.ts";

export type GateState = "loading" | "anonymous" | "denied" | "ready" | "error";

export const CONTENT_ROLES: readonly string[] = ["admin", "secretariat", "editor"];

const ROLE_LABELS: Readonly<Record<string, string>> = STAFF_ROLE_LABELS;

export function gateDecision(status: number, email: unknown): GateState {
  if (status === 200 && typeof email === "string" && email.length > 0) {
    return "ready";
  }
  if (status === 401) {
    return "anonymous";
  }
  if (status === 403) {
    return "denied";
  }
  return "error";
}

export function canEditContent(role: string): boolean {
  return CONTENT_ROLES.includes(role);
}

export function gatePhrases(state: GateState): readonly string[] {
  switch (state) {
    case "loading":
      return ["Sprawdzam dostęp do panelu…"];
    case "anonymous":
      return [
        "Ten panel wymaga zalogowania przez Cloudflare Access.",
        "Zaloguj się szkolnym kontem na stronie logowania i otwórz panel ponownie.",
      ];
    case "denied":
      return [
        "Brak uprawnień do treści.",
        "Jeśli powinna to być twoja rola, napisz do administratora.",
      ];
    case "error":
      return ["Panel nie odpowiada. Odczekaj chwilę i spróbuj ponownie."];
    case "ready":
      return [];
  }
}

export function rolePhrase(role: string): string | undefined {
  return ROLE_LABELS[role];
}
