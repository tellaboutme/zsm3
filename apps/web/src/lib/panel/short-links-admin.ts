import type { PanelAdminShortLinkItem } from "@zsm3/contracts/panel";

import { problemPhrase } from "./api.ts";
import {
  dateTimePhrase,
  LINKS_PAGE_SIZE,
  LINKS_PATH,
  plural,
  type LinksCursor,
} from "./short-links.ts";

export const ADMIN_LINKS_PATH = `${LINKS_PATH}/all`;

export function adminLinksPath(cursor: LinksCursor | null): string {
  const query = new URLSearchParams({ limit: String(LINKS_PAGE_SIZE) });
  if (cursor !== null) {
    query.set("beforeCreatedAt", cursor.createdAt);
    query.set("beforeCode", cursor.code);
  }
  return `${ADMIN_LINKS_PATH}?${query.toString()}`;
}

export function adminRevokePath(code: string): string {
  return `${ADMIN_LINKS_PATH}/${encodeURIComponent(code)}`;
}

export function adminMeta(item: PanelAdminShortLinkItem): string {
  const parts = [
    `autor ${item.owner}`,
    item.kind === "file" ? "plik" : "strona",
    `utworzony ${dateTimePhrase(item.createdAt)}`,
    `działa do ${dateTimePhrase(item.expiresAt)}`,
  ];
  return [...parts, ...(item.passwordProtected ? ["z hasłem"] : [])].join(" · ");
}

export function adminListPhrase(count: number, more: boolean): string {
  if (count === 0) {
    return "Żaden pracownik nie ma teraz aktywnych linków.";
  }
  const shown = `Aktywne linki wszystkich pracowników: ${String(count)} ${plural(count, "link", "linki", "linków")}.`;
  return more ? `${shown} Starsze wczytasz przyciskiem „Pokaż starsze”.` : shown;
}

export function adminRevokePhrase(status: number): string {
  if (status === 204) {
    return "Link unieważniony. Przestał działać od razu, a w dzienniku zapisano, kto to zrobił.";
  }
  return status === 404
    ? "Ten link jest już nieaktywny: wygasł albo ktoś go unieważnił. Odśwież listę."
    : problemPhrase(status);
}
