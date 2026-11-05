import type { PanelAdminShortLinkItem, PanelShortLinkCursor } from "@zsm3/contracts/panel";
import { shortCodeSchema } from "@zsm3/contracts/short-links";
import { z } from "zod";

import { allRows, timestamp, type Store } from "./database.ts";
import { uuidv7 } from "./ids.ts";
import { uniformChanges } from "./short-link-audit.ts";
import {
  ADMIN_REVOKE_SHORT_LINK,
  AUDIT_ADMIN_REVOKE,
  SELECT_ACTIVE_LINKS_PAGE,
} from "./short-links-admin-sql.ts";

export const ADMIN_LINK_LIMIT = 200;

const flagSchema = z.union([z.literal(0), z.literal(1)]);

const activeRowSchema = z.strictObject({
  code: shortCodeSchema,
  created_by: z.string().min(1),
  created_at: z.string(),
  expires_at: z.string(),
  password_protected: flagSchema,
  is_file: flagSchema,
});

export interface ActiveLinksQuery {
  readonly now: string;
  readonly cursor: PanelShortLinkCursor | null;
  readonly limit: number;
}

export interface ShortLinksAdminRepo {
  active(query: ActiveLinksQuery): Promise<readonly PanelAdminShortLinkItem[]>;
  revokeAny(code: string, admin: string): Promise<boolean>;
}

function toItem(row: z.infer<typeof activeRowSchema>): PanelAdminShortLinkItem {
  return {
    code: row.code,
    owner: row.created_by,
    kind: row.is_file === 1 ? "file" : "url",
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    passwordProtected: row.password_protected === 1,
  };
}

async function revokeAny(store: Store, code: string, admin: string): Promise<boolean> {
  const { db, random } = store;
  const at = timestamp(store.clock);
  const result = await db.batch([
    db.prepare(AUDIT_ADMIN_REVOKE).bind(uuidv7(Date.parse(at), random), at, admin, code),
    db.prepare(ADMIN_REVOKE_SHORT_LINK).bind(code, at),
  ]);
  return uniformChanges(result, 2, "admin revoke");
}

export function shortLinksAdminRepo(store: Store): ShortLinksAdminRepo {
  return {
    active: async ({ now, cursor, limit }) => {
      const statement = store.db
        .prepare(SELECT_ACTIVE_LINKS_PAGE)
        .bind(
          now,
          cursor?.createdAt ?? null,
          cursor?.code ?? null,
          z.int().min(1).max(ADMIN_LINK_LIMIT).parse(limit) + 1,
        );
      return (await allRows(statement, activeRowSchema)).map(toItem);
    },
    revokeAny: async (code, admin) => revokeAny(store, code, admin),
  };
}
