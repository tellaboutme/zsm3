import type { PanelShortLinkItem } from "@zsm3/contracts/panel";
import { SCHOOL_TIME_ZONE, schoolYearOf } from "@zsm3/contracts/short-link-expiry";
import {
  linkFileFormats,
  MAX_LINK_FILE_BYTES,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@zsm3/contracts/short-links";

import { problemPhrase } from "./api.ts";
import { bytesPhrase } from "./uploads.ts";

export type LinkStatus = "active" | "expired" | "revoked";

export interface LinksCursor {
  readonly createdAt: string;
  readonly code: string;
}

export const LINKS_PAGE_SIZE = 20;
export const LINKS_PATH = "/api/panel/short-links";
export const LINK_FILES_PATH = "/api/panel/short-links/files";

export const LINK_STATUS_LABELS: Readonly<Record<LinkStatus, string>> = {
  active: "Aktywny",
  expired: "Wygasł",
  revoked: "Unieważniony",
};

const MB = 1024 * 1024;
const FORMAT_LIST = linkFileFormats.map((format) => format.toUpperCase()).join(", ");

const dateTime = new Intl.DateTimeFormat("pl-PL", {
  timeZone: SCHOOL_TIME_ZONE,
  dateStyle: "long",
  timeStyle: "short",
});

export function plural(count: number, one: string, few: string, many: string): string {
  if (count === 1) {
    return one;
  }
  const units = count % 10;
  const tens = count % 100;
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many;
}

export function linkStatus(item: PanelShortLinkItem, now: Date): LinkStatus {
  if (item.revokedAt !== null) {
    return "revoked";
  }
  return Date.parse(item.expiresAt) <= now.getTime() ? "expired" : "active";
}

export function shortUrl(origin: string, code: string): string {
  return `${origin}/s/${code}`;
}

export function dateTimePhrase(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function destinationPhrase(item: PanelShortLinkItem): string {
  if (item.file === null) {
    return item.target ?? "";
  }
  const { name, format, bytes } = item.file;
  return `Plik ${name} (${format.toUpperCase()}, ${bytesPhrase(bytes)})`;
}

export function clicksPhrase(count: number): string {
  return `${String(count)} ${plural(count, "otwarcie", "otwarcia", "otwarć")}`;
}

export function linkMeta(item: PanelShortLinkItem): string {
  const parts = [
    `utworzony ${dateTimePhrase(item.createdAt)}`,
    `działa do ${dateTimePhrase(item.expiresAt)}`,
    clicksPhrase(item.clicks),
  ];
  return [...parts, ...(item.passwordProtected ? ["z hasłem"] : [])].join(" · ");
}

export function schoolYearNote(now: Date): string {
  const start = schoolYearOf(now);
  const end = String(start + 1);
  return `Link będzie działać do końca roku szkolnego ${String(start)}/${end}, czyli do 31 sierpnia ${end} włącznie. Potem wygaśnie sam.`;
}

export function linksPath(cursor: LinksCursor | null): string {
  const query = new URLSearchParams({ limit: String(LINKS_PAGE_SIZE) });
  if (cursor !== null) {
    query.set("beforeCreatedAt", cursor.createdAt);
    query.set("beforeCode", cursor.code);
  }
  return `${LINKS_PATH}?${query.toString()}`;
}

export function revokePath(code: string): string {
  return `${LINKS_PATH}/${encodeURIComponent(code)}`;
}

export function listPhrase(count: number, more: boolean): string {
  if (count === 0) {
    return "Nie masz jeszcze żadnych linków. Utwórz pierwszy formularzem powyżej.";
  }
  const shown = `Na liście: ${String(count)} ${plural(count, "link", "linki", "linków")}.`;
  return more ? `${shown} Starsze wczytasz przyciskiem „Pokaż starsze”.` : shown;
}

export type FileCheck =
  { readonly ok: true } | { readonly ok: false; readonly reason: "empty" | "large" | "format" };

export function checkLinkFile(name: string, bytes: number): FileCheck {
  if (bytes <= 0) {
    return { ok: false, reason: "empty" };
  }
  if (bytes > MAX_LINK_FILE_BYTES) {
    return { ok: false, reason: "large" };
  }
  const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const known = name.includes(".") && linkFileFormats.some((format) => format === extension);
  return known ? { ok: true } : { ok: false, reason: "format" };
}

export function fileCheckPhrase(check: FileCheck): string {
  if (check.ok) {
    return "Plik spełnia warunki. Możesz utworzyć link.";
  }
  switch (check.reason) {
    case "empty":
      return "Plik jest pusty.";
    case "large":
      return `Plik przekracza limit ${String(MAX_LINK_FILE_BYTES / MB)} MB.`;
    case "format":
      return `Dozwolone są tylko pliki ${FORMAT_LIST}.`;
  }
}

const CREATE_PROBLEMS: Readonly<Record<number, string>> = {
  413: `Plik przekracza limit ${String(MAX_LINK_FILE_BYTES / MB)} MB.`,
  415: `Tego pliku nie można udostępnić. Dozwolone są dokumenty ${FORMAT_LIST} bez makr i osadzonych obiektów OLE; o rodzaju pliku decyduje jego zawartość, nie nazwa.`,
  422: `Sprawdź pola: adres musi zaczynać się od https://, a hasło mieć od ${String(MIN_PASSWORD_LENGTH)} do ${String(MAX_PASSWORD_LENGTH)} znaków.`,
  503: "Linku z hasłem nie da się teraz utworzyć, bo serwer nie ma klucza haseł. Utwórz link bez hasła albo napisz do administratora.",
};

export function createPhrase(status: number): string {
  return CREATE_PROBLEMS[status] ?? problemPhrase(status);
}

export function revokePhrase(status: number): string {
  if (status === 204) {
    return "Link unieważniony. Przestał działać od razu.";
  }
  return status === 404
    ? "Ten link jest już unieważniony albo nie należy do ciebie. Odśwież listę."
    : problemPhrase(status);
}
