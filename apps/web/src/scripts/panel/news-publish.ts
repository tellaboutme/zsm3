import type { PublicationStatus } from "@zsm3/contracts/content";

import { speak } from "./dom.ts";
import type { NewsParts } from "./news-parts.ts";
import { panelRead } from "../../lib/panel/api.ts";
import { PANEL_SCHEMAS, parse } from "../../lib/panel/models.ts";

export interface SavedState {
  status: PublicationStatus;
}

export function applyPublish(
  parts: NewsParts,
  current: PublicationStatus,
  saved: SavedState,
): void {
  const state = saved;
  state.status = current;
  const publish = parts.publish;
  const unpublish = parts.unpublish;
  publish.hidden = current === "published";
  unpublish.hidden = current !== "published";
  publish.disabled = parts.ref.slug.length === 0;
  unpublish.disabled = parts.ref.slug.length === 0;
}

export function savedPhrase(status: PublicationStatus): string {
  return status === "published" ? "Zapisano. Aktualność jest opublikowana." : "Zapisano szkic.";
}

export function unknownPublishPhrase(): string {
  return "Zapisano, ale nowy stan publikacji jest nieznany.";
}

export async function syncPublish(
  parts: NewsParts,
  path: string,
  saved: SavedState,
): Promise<void> {
  const response = await panelRead(path);
  const view = parse(PANEL_SCHEMAS.newsView, response.data);
  const status = view?.item.status;
  if (status === undefined) {
    speak(parts.status, [unknownPublishPhrase()]);
    return;
  }
  applyPublish(parts, status, saved);
  speak(parts.status, [savedPhrase(status)]);
}
