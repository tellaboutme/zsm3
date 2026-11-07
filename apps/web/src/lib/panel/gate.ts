import type { PanelStaffRole } from "@zsm3/contracts/panel";

import { STAFF_ROLE_LABELS } from "./staff.ts";

export type GateState = "loading" | "anonymous" | "denied" | "ready" | "error";

export const CONTENT_ROLES: readonly PanelStaffRole[] = ["admin", "secretariat", "editor"];

export const GALLERY_ROLES: readonly PanelStaffRole[] = ["admin", "gallery_editor"];

export const REQUEST_ROLES: readonly PanelStaffRole[] = ["admin", "secretariat"];

export const QUESTION_ROLES: readonly PanelStaffRole[] = ["counsellor"];

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

export function sectionAllowed(roles: string | undefined, role: string): boolean {
  return roles === undefined || roles.split(" ").includes(role);
}

function hasRole(roles: readonly PanelStaffRole[], role: string): boolean {
  return roles.some((allowed) => allowed === role);
}

export function canEditContent(role: string): boolean {
  return hasRole(CONTENT_ROLES, role);
}

export function canManageGallery(role: string): boolean {
  return hasRole(GALLERY_ROLES, role);
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
