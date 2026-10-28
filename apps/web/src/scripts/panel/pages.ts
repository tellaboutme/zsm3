import "../../lib/panel/zod-jitless.ts";
import { revealEditor } from "./editor-navigation.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wirePageForm } from "./pages-form.ts";
import { wirePageList } from "./pages-list.ts";
import { wireRevisions } from "./revisions-ui.ts";
import { wireShell } from "./shell.ts";
import { canEditContent } from "../../lib/panel/gate.ts";

function boot(section: HTMLElement): void {
  const view = gateView(section);
  const form = wirePageForm(section, () => {
    void list.refresh();
  });
  const list = wirePageList(section, (path) => {
    form.open(path);
    history.open(path);
    revealEditor(section);
  });
  const history = wireRevisions(section, "pages", (path) => {
    form.open(path);
    void list.refresh();
    revealEditor(section);
  });
  wireShell(view, (role) => {
    if (!canEditContent(role)) {
      denyContent(view);
      return;
    }
    void list.refresh();
  });
}

const section = document.querySelector<HTMLElement>('[data-panel-page="pages"]');

if (section !== null) {
  boot(section);
}
