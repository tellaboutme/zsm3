import type { RevisionTarget } from "@zsm3/contracts/revisions";

import { area, areaList, button, el, speak } from "./dom.ts";
import { panelRead, panelSend, problemPhrase } from "../../lib/panel/api.ts";
import { PANEL_SCHEMAS, parse } from "../../lib/panel/models.ts";
import {
  restoreMutation,
  revisionLine,
  revisionsPath,
  type RevisionSummary,
} from "../../lib/panel/revisions.ts";

export interface RevisionsUi {
  readonly open: (id: string) => void;
}

interface Parts {
  readonly root: HTMLElement;
  readonly rows: HTMLUListElement;
  readonly status: HTMLElement;
  readonly target: RevisionTarget;
  readonly onRestored: (id: string) => void;
  readonly onLoaded: (() => void) | undefined;
}

function rowNode(parts: Parts, id: string, item: RevisionSummary): HTMLElement {
  const restore = button("Przywróć tę wersję");
  restore.setAttribute("aria-label", `Przywróć wersję ${String(item.revision)}: ${item.title}`);
  restore.addEventListener("click", () => {
    void restoreVersion(parts, id, item.revision);
  });
  return el("li", {
    className: "panel-item",
    children: [
      el("p", { className: "panel-meta", text: revisionLine(item) }),
      el("p", { text: item.title }),
      restore,
    ],
  });
}

async function load(parts: Parts, id: string): Promise<void> {
  const { root } = parts;
  root.hidden = false;
  const response = await panelRead(revisionsPath(parts.target, id));
  const list = parse(PANEL_SCHEMAS.revisionList, response.data);
  if (list === undefined) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  parts.rows.replaceChildren(...list.items.map((item) => rowNode(parts, id, item)));
  speak(parts.status, [
    list.items.length === 0
      ? "Brak wcześniejszych wersji. Pojawią się po pierwszej zmianie."
      : "Przywrócenie zachowuje obecny status publikacji, a bieżąca treść trafia do historii.",
  ]);
  parts.onLoaded?.();
}

async function restoreVersion(parts: Parts, id: string, revision: number): Promise<void> {
  const response = await panelSend(
    "POST",
    "/api/panel/revisions/restore",
    restoreMutation(parts.target, id, revision),
  );
  if (!response.ok) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  parts.onRestored(id);
  await load(parts, id);
  speak(parts.status, [`Przywrócono wersję ${String(revision)}.`]);
}

export function wireRevisions(
  section: HTMLElement,
  target: RevisionTarget,
  onRestored: (id: string) => void,
  onLoaded?: () => void,
): RevisionsUi {
  const root = area(section, "history");
  const parts: Parts = {
    root,
    rows: areaList(root, "history-rows"),
    status: area(root, "history-status"),
    target,
    onRestored,
    onLoaded,
  };
  return {
    open: (id) => {
      void load(parts, id);
    },
  };
}
