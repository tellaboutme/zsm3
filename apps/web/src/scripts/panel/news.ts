import "../../lib/panel/zod-jitless.ts";
import { wireBlocks } from "./blocks-ui.ts";
import { area } from "./dom.ts";
import { revealEditor } from "./editor-navigation.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireEditor } from "./news-form.ts";
import { wireList } from "./news-list.ts";
import { wireRevisions } from "./revisions-ui.ts";
import { wireShell } from "./shell.ts";
import { canEditContent } from "../../lib/panel/gate.ts";

function boot(section: HTMLElement): void {
  const view = gateView(section);
  const blocks = wireBlocks(area(section, "blocks-root"));
  const list = wireList(section, (ref) => {
    editor.open(ref);
    history.open(ref);
    revealEditor(section);
  });
  const history = wireRevisions(
    section,
    "news",
    (ref) => {
      editor.open(ref);
      void list.refresh();
      revealEditor(section);
    },
    () => {
      revealEditor(section);
    },
  );
  const editor = wireEditor(section, blocks, () => {
    void list.refresh();
  });
  wireShell(view, (role) => {
    if (!canEditContent(role)) {
      denyContent(view);
      return;
    }
    void list.refresh();
  });
}

const section = document.querySelector<HTMLElement>('[data-panel-page="news"]');

if (section !== null) {
  boot(section);
}
