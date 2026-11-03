import type { PanelShortLinkItem } from "@zsm3/contracts/panel";
import { describe, it } from "vitest";

import {
  checkLinkFile,
  clicksPhrase,
  createPhrase,
  dateTimePhrase,
  destinationPhrase,
  fileCheckPhrase,
  LINK_FILES_PATH,
  LINK_STATUS_LABELS,
  linkMeta,
  linksPath,
  LINKS_PAGE_SIZE,
  linkStatus,
  listPhrase,
  plural,
  revokePath,
  revokePhrase,
  schoolYearNote,
  shortUrl,
} from "../src/lib/panel/short-links.ts";

const ITEM: PanelShortLinkItem = {
  code: "k7mq4ra",
  target: "https://example.org/lekcja",
  file: null,
  createdAt: "2026-11-03T09:15:00.000Z",
  expiresAt: "2027-08-31T22:00:00.000Z",
  revokedAt: null,
  clicks: 0,
  passwordProtected: false,
};

describe("short link status", () => {
  it("is revoked first, then expired from the exact expiry moment, else active", ({ expect }) => {
    const expiry = new Date(ITEM.expiresAt);
    expect(linkStatus(ITEM, new Date(expiry.getTime() - 1))).toBe("active");
    expect(linkStatus(ITEM, expiry)).toBe("expired");
    expect(linkStatus({ ...ITEM, revokedAt: "2026-12-01T10:00:00.000Z" }, new Date(0))).toBe(
      "revoked",
    );
    expect(LINK_STATUS_LABELS).toEqual({
      active: "Aktywny",
      expired: "Wygasł",
      revoked: "Unieważniony",
    });
  });
});

describe("Polish plurals", () => {
  it("picks the form for one, a few and many", ({ expect }) => {
    const forms = [0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 24, 25, 102, 112, 122].map((count) =>
      plural(count, "link", "linki", "linków"),
    );
    expect(forms).toEqual([
      "linków",
      "link",
      "linki",
      "linki",
      "linków",
      "linków",
      "linków",
      "linków",
      "linków",
      "linki",
      "linki",
      "linków",
      "linki",
      "linków",
      "linki",
    ]);
    expect(clicksPhrase(1)).toBe("1 otwarcie");
    expect(clicksPhrase(3)).toBe("3 otwarcia");
    expect(clicksPhrase(5)).toBe("5 otwarć");
  });
});

describe("describing a link", () => {
  it("builds the public short address", ({ expect }) => {
    expect(shortUrl("https://zsm3.pl", "k7mq4ra")).toBe("https://zsm3.pl/s/k7mq4ra");
  });

  it("shows dates in Warsaw time", ({ expect }) => {
    expect(dateTimePhrase("2027-08-31T22:00:00.000Z")).toBe("1 września 2027 00:00");
    expect(dateTimePhrase("2026-12-31T23:30:00.000Z")).toBe("1 stycznia 2027 00:30");
  });

  it("names the target address or the file", ({ expect }) => {
    expect(destinationPhrase(ITEM)).toBe("https://example.org/lekcja");
    expect(
      destinationPhrase({
        ...ITEM,
        target: null,
        file: { name: "Karta.pdf", format: "pdf", bytes: 2048 },
      }),
    ).toBe("Plik Karta.pdf (PDF, 2 KB)");
    expect(destinationPhrase({ ...ITEM, target: null })).toBe("");
  });

  it("sums up dates, clicks and the password in one line", ({ expect }) => {
    expect(linkMeta(ITEM)).toBe(
      "utworzony 3 listopada 2026 10:15 · działa do 1 września 2027 00:00 · 0 otwarć",
    );
    expect(linkMeta({ ...ITEM, clicks: 2, passwordProtected: true })).toBe(
      "utworzony 3 listopada 2026 10:15 · działa do 1 września 2027 00:00 · 2 otwarcia · z hasłem",
    );
  });

  it("announces the school year a new link will last", ({ expect }) => {
    expect(schoolYearNote(new Date("2026-11-03T10:00:00.000Z"))).toBe(
      "Link będzie działać do końca roku szkolnego 2026/2027, czyli do 31 sierpnia 2027 włącznie. Potem wygaśnie sam.",
    );
    expect(schoolYearNote(new Date("2027-08-31T22:00:00.000Z"))).toContain("2027/2028");
  });
});

describe("panel addresses", () => {
  it("pages the list newest first with a cursor", ({ expect }) => {
    expect(LINKS_PAGE_SIZE).toBe(20);
    expect(linksPath(null)).toBe("/api/panel/short-links?limit=20");
    expect(linksPath({ createdAt: ITEM.createdAt, code: "k7mq4ra" })).toBe(
      "/api/panel/short-links?limit=20&beforeCreatedAt=2026-11-03T09%3A15%3A00.000Z&beforeCode=k7mq4ra",
    );
    expect(revokePath("a/b")).toBe("/api/panel/short-links/a%2Fb");
    expect(LINK_FILES_PATH).toBe("/api/panel/short-links/files");
  });

  it("describes the list for screen readers", ({ expect }) => {
    expect(listPhrase(0, false)).toBe(
      "Nie masz jeszcze żadnych linków. Utwórz pierwszy formularzem powyżej.",
    );
    expect(listPhrase(1, false)).toBe("Na liście: 1 link.");
    expect(listPhrase(3, true)).toBe(
      "Na liście: 3 linki. Starsze wczytasz przyciskiem „Pokaż starsze”.",
    );
  });
});

describe("checking a file before upload", () => {
  it("refuses empty, oversized and unknown files", ({ expect }) => {
    expect(checkLinkFile("karta.pdf", 0)).toEqual({ ok: false, reason: "empty" });
    expect(checkLinkFile("karta.pdf", 20 * 1024 * 1024 + 1)).toEqual({
      ok: false,
      reason: "large",
    });
    expect(checkLinkFile("karta.pdf", 20 * 1024 * 1024)).toEqual({ ok: true });
    expect(checkLinkFile("Karta.ODP", 1)).toEqual({ ok: true });
    expect(checkLinkFile("strona.html", 1)).toEqual({ ok: false, reason: "format" });
    expect(checkLinkFile("pdf", 1)).toEqual({ ok: false, reason: "format" });
    expect(checkLinkFile("archiwum.zip", 1)).toEqual({ ok: false, reason: "format" });
  });

  it("explains each verdict in Polish", ({ expect }) => {
    expect(fileCheckPhrase({ ok: true })).toBe("Plik spełnia warunki. Możesz utworzyć link.");
    expect(fileCheckPhrase({ ok: false, reason: "empty" })).toBe("Plik jest pusty.");
    expect(fileCheckPhrase({ ok: false, reason: "large" })).toBe("Plik przekracza limit 20 MB.");
    expect(fileCheckPhrase({ ok: false, reason: "format" })).toBe(
      "Dozwolone są tylko pliki PDF, DOCX, XLSX, PPTX, ODT, ODS, ODP.",
    );
  });
});

describe("server answers", () => {
  it("explains a refused link or upload", ({ expect }) => {
    expect(createPhrase(413)).toBe("Plik przekracza limit 20 MB.");
    expect(createPhrase(415)).toBe(
      "Tego pliku nie można udostępnić. Dozwolone są dokumenty PDF, DOCX, XLSX, PPTX, ODT, ODS, ODP bez makr; o rodzaju pliku decyduje jego zawartość, nie nazwa.",
    );
    expect(createPhrase(422)).toBe(
      "Sprawdź pola: adres musi zaczynać się od https://, a hasło mieć od 6 do 200 znaków.",
    );
    expect(createPhrase(503)).toBe(
      "Linku z hasłem nie da się teraz utworzyć, bo serwer nie ma klucza haseł. Utwórz link bez hasła albo napisz do administratora.",
    );
    expect(createPhrase(403)).toBe("Brak uprawnień do tej czynności.");
  });

  it("explains the result of a revocation", ({ expect }) => {
    expect(revokePhrase(204)).toBe("Link unieważniony. Przestał działać od razu.");
    expect(revokePhrase(404)).toBe(
      "Ten link jest już unieważniony albo nie należy do ciebie. Odśwież listę.",
    );
    expect(revokePhrase(500)).toBe("Błąd serwera. Odczekaj chwilę i spróbuj ponownie.");
  });
});
