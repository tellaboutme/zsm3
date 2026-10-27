import type { PanelSession } from "./deps.ts";
import type { AuditEntry } from "../../storage/audit-repo.ts";

export interface PanelAuditUsage {
  readonly session: PanelSession;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string;
  readonly fields: readonly string[];
}

export function auditEntry({
  session,
  action,
  entity,
  entityId,
  fields,
}: PanelAuditUsage): AuditEntry {
  return {
    actorEmail: session.email,
    action,
    entity,
    entityId,
    details: JSON.stringify({ fields }),
  };
}

export function createdFields(item: object): readonly string[] {
  return Object.keys(item);
}

export function changedFields(before: object, after: object): readonly string[] {
  const beforeEntries = new Map(Object.entries(before));
  const afterEntries = new Map(Object.entries(after));
  const names = new Set([...beforeEntries.keys(), ...afterEntries.keys()]);
  return [...names].filter(
    (name) => JSON.stringify(beforeEntries.get(name)) !== JSON.stringify(afterEntries.get(name)),
  );
}
