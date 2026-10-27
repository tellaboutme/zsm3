import { it } from "vitest";

import { auditAction, auditHead, auditLine, auditPath } from "../src/lib/panel/audit.ts";

const ITEM = {
  at: "2026-10-26T13:05:00.000Z",
  actorEmail: "redakcja@zsm3.pl",
  action: "pages.save",
  entity: "pages",
  entityId: "/kontakt",
  fields: ["title", "intro"],
};

it("describes each audit entry in Polish", ({ expect }) => {
  expect(auditAction("bells.save")).toBe("zapisał(a) dzwonki");
  expect(auditAction("retention.run")).toBe("retention.run");
  expect(auditLine(ITEM)).toBe("zapisał(a) stronę: /kontakt (pola: title, intro)");
  expect(auditLine({ ...ITEM, fields: [] })).toBe("zapisał(a) stronę: /kontakt");
  expect(auditHead(ITEM)).toContain("redakcja@zsm3.pl");
  expect(auditHead(ITEM)).toContain("14:05");
  expect(auditHead({ ...ITEM, actorEmail: null }).endsWith(" · system")).toBe(true);
});

it("asks for the first or an older page", ({ expect }) => {
  expect(auditPath(null)).toBe("/api/panel/audit");
  expect(auditPath("2026-10-26T13:05:00.000Z|abc")).toBe(
    "/api/panel/audit?before=2026-10-26T13%3A05%3A00.000Z%7Cabc",
  );
});

it("labels every panel action", ({ expect }) => {
  expect(
    Object.fromEntries(
      [
        "news.create",
        "news.update",
        "news.publish",
        "news.unpublish",
        "news.restore",
        "pages.save",
        "pages.restore",
        "events.save",
        "files.upload",
        "redirects.save",
        "redirects.delete",
        "staff.save",
        "announcements.create",
        "announcements.update",
        "announcements.delete",
        "bells.save",
        "datasets.save",
      ].map((action) => [action, auditAction(action)]),
    ),
  ).toMatchSnapshot();
});
