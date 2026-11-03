import type { PanelHarness } from "./panel-support.ts";
import { liveStore } from "../../src/storage/database.ts";
import { revisionsRepo } from "../../src/storage/revisions-repo.ts";

export async function currentRevision(
  harness: Pick<PanelHarness, "env">,
  entity: string,
  id: string,
): Promise<number> {
  return revisionsRepo(liveStore(harness.env.DB)).current(entity, id);
}
