import { describe, it } from "vitest";

import {
  ADMIN_LINKS_PATH,
  adminLinksPath,
  adminListPhrase,
  adminMeta,
  adminRevokePath,
  adminRevokePhrase,
} from "../src/lib/panel/short-links-admin.ts";
import { dateTimePhrase } from "../src/lib/panel/short-links.ts";

const ITEM = {
  code: "k7mq4ra",
  owner: "byly-nauczyciel@zsm3.test",
  kind: "file",
  createdAt: "2026-10-01T08:00:00.000Z",
  expiresAt: "2027-08-31T22:00:00.000Z",
  passwordProtected: true,
} as const;

describe("administrator short link helpers", () => {
  it("builds the list and revoke paths with the author cursor", ({ expect }) => {
    expect(ADMIN_LINKS_PATH).toBe("/api/panel/short-links/all");
    expect(adminLinksPath(null)).toBe("/api/panel/short-links/all?limit=20");
    expect(adminLinksPath({ createdAt: ITEM.createdAt, code: ITEM.code })).toBe(
      "/api/panel/short-links/all?limit=20&beforeCreatedAt=2026-10-01T08%3A00%3A00.000Z&beforeCode=k7mq4ra",
    );
    expect(adminRevokePath("k7mq4ra")).toBe("/api/panel/short-links/all/k7mq4ra");
  });

  it("describes a link by owner, kind, dates and password only", ({ expect }) => {
    const dates = `utworzony ${dateTimePhrase(ITEM.createdAt)} · działa do ${dateTimePhrase(ITEM.expiresAt)}`;

    expect(adminMeta(ITEM)).toBe(`autor byly-nauczyciel@zsm3.test · plik · ${dates} · z hasłem`);
    expect(adminMeta({ ...ITEM, kind: "url", passwordProtected: false })).toBe(
      `autor byly-nauczyciel@zsm3.test · strona · ${dates}`,
    );
  });

  it("counts the list and explains each revocation answer", ({ expect }) => {
    expect(adminListPhrase(0, false)).toBe("Żaden pracownik nie ma teraz aktywnych linków.");
    expect(adminListPhrase(1, false)).toBe("Aktywne linki wszystkich pracowników: 1 link.");
    expect(adminListPhrase(5, false)).toBe("Aktywne linki wszystkich pracowników: 5 linków.");
    expect(adminListPhrase(3, true)).toBe(
      "Aktywne linki wszystkich pracowników: 3 linki. Starsze wczytasz przyciskiem „Pokaż starsze”.",
    );
    expect(adminRevokePhrase(204)).toBe(
      "Link unieważniony. Przestał działać od razu, a w dzienniku zapisano, kto to zrobił.",
    );
    expect(adminRevokePhrase(404)).toBe(
      "Ten link jest już nieaktywny: wygasł albo ktoś go unieważnił. Odśwież listę.",
    );
    expect(adminRevokePhrase(403)).not.toBe(adminRevokePhrase(404));
  });
});
