import { batchChanges, timestamp, type SqlStatement, type Store } from "./database.ts";
import { uuidv7 } from "./ids.ts";
import { AUDIT_SHORT_LINK_CREATE } from "./short-links-sql.ts";

export interface LinkCreation {
  readonly code: string;
  readonly createdBy: string;
  readonly kind: "url" | "file";
  readonly passwordProtected: boolean;
}

export function creationAudit(store: Store, creation: LinkCreation): SqlStatement {
  const at = timestamp(store.clock);
  const details = { kind: creation.kind, passwordProtected: creation.passwordProtected };
  return store.db
    .prepare(AUDIT_SHORT_LINK_CREATE)
    .bind(
      uuidv7(Date.parse(at), store.random),
      at,
      creation.createdBy,
      JSON.stringify(details),
      creation.code,
    );
}

export function uniformChanges(result: unknown, size: number, what: string): boolean {
  const changes = batchChanges(result);
  const [first] = changes;
  if (
    changes.length !== size ||
    changes.some((count) => count !== first) ||
    (first !== 0 && first !== 1)
  ) {
    throw new Error(`Inconsistent short link ${what} batch`);
  }
  return first === 1;
}
