import type { PanelDeps } from "./deps.ts";
import { announcesChange, type PublicChange } from "../../domain/public-change.ts";
import { logEvent } from "../../logging/log.ts";

async function delivered(attempt: Promise<boolean>): Promise<boolean> {
  try {
    return await attempt;
  } catch (error) {
    logEvent({
      event: "indexnow_unavailable",
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}

export async function announce(deps: PanelDeps, change: PublicChange, path: string): Promise<void> {
  if (announcesChange(change)) {
    await deps.defer(delivered(deps.notifyIndexNow(path)));
  }
}
