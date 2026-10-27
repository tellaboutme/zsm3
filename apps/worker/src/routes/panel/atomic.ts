import type { PanelDeps } from "./deps.ts";
import type { SqlStatement } from "../../storage/database.ts";

export async function atomicWrite(
  deps: PanelDeps,
  statements: readonly SqlStatement[],
): Promise<void> {
  await deps.db.batch([...statements]);
}
