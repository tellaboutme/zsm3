import type { PanelAuditList } from "@zsm3/contracts/audit";

type AuditItem = PanelAuditList["items"][number];

const ACTION_LABELS: Readonly<Record<string, string>> = {
  "news.create": "utworzył(a) aktualność",
  "news.update": "zmienił(a) aktualność",
  "news.publish": "opublikował(a) aktualność",
  "news.unpublish": "wycofał(a) aktualność",
  "news.restore": "przywrócił(a) wersję aktualności",
  "pages.save": "zapisał(a) stronę",
  "pages.restore": "przywrócił(a) wersję strony",
  "events.save": "zapisał(a) terminarz",
  "files.upload": "dodał(a) plik",
  "redirects.save": "zapisał(a) przekierowanie",
  "redirects.delete": "usunął(ęła) przekierowanie",
  "staff.save": "zmienił(a) dostęp pracownika",
  "announcements.create": "dodał(a) ogłoszenie",
  "announcements.update": "zmienił(a) ogłoszenie",
  "announcements.delete": "usunął(ęła) ogłoszenie",
  "bells.save": "zapisał(a) dzwonki",
  "datasets.save": "zapisał(a) dane strony",
};

const MOMENT = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function auditAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function auditHead(item: AuditItem): string {
  return `${MOMENT.format(new Date(item.at))} · ${item.actorEmail ?? "system"}`;
}

export function auditLine(item: AuditItem): string {
  const fields = item.fields.length === 0 ? "" : ` (pola: ${item.fields.join(", ")})`;
  return `${auditAction(item.action)}: ${item.entityId}${fields}`;
}

export function auditPath(next: string | null): string {
  return next === null ? "/api/panel/audit" : `/api/panel/audit?before=${encodeURIComponent(next)}`;
}
