import "../../lib/panel/zod-jitless.ts";
import { area, areaForm, areaInput, button, el, speak } from "./dom.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { panelDelete, panelRead, panelSend, problemPhrase } from "../../lib/panel/api.ts";
import { PANEL_SCHEMAS, parse, type PanelRedirectList } from "../../lib/panel/models.ts";
import { redirectSave } from "../../lib/panel/mutations.ts";

interface Parts {
  readonly form: HTMLFormElement;
  readonly fromInput: HTMLInputElement;
  readonly toInput: HTMLInputElement;
  readonly rows: HTMLUListElement;
  readonly status: HTMLElement;
}

interface Target {
  readonly from: string;
  readonly to: string;
}

function rowListOf(section: HTMLElement): HTMLUListElement {
  const node = area(section, "redirect-rows");
  if (node instanceof HTMLUListElement) {
    return node;
  }
  throw new Error(`missing list [data-panel="redirect-rows"]`);
}

function partsFor(section: HTMLElement): Parts {
  const form = areaForm(section, "redirect-form");
  const fromInput = areaInput(form, "from");
  const toInput = areaInput(form, "to");
  return {
    form,
    fromInput,
    toInput,
    rows: rowListOf(section),
    status: area(section, "status"),
  };
}

function usablePath(value: string): string | undefined {
  const path = value.trim();
  if (path.startsWith("/") && !path.includes("\n") && path.includes("/") && path.length < 500) {
    return path;
  }
  return undefined;
}

function rowNode(parts: Parts, target: Target): HTMLElement {
  const node = document.createElement("li");
  node.className = "panel-item";
  node.dataset["from"] = target.from;
  const head = el("p", { className: "panel-meta", text: target.from });
  const input = document.createElement("input");
  input.dataset["part"] = "to";
  input.value = target.to;
  const label = el("label", { text: "Cel", children: [input] });
  node.append(head, label, saveButton(parts, node), wipeButton(parts, node));
  return node;
}

function saveButton(parts: Parts, node: HTMLElement): HTMLElement {
  const from = node.dataset["from"] ?? "";
  const nodeButton = button("Zapisz", "panel-redirect-save");
  nodeButton.setAttribute("aria-label", `Zapisz przekierowanie ${from}`);
  nodeButton.addEventListener("click", () => {
    void sendRoute(parts, from, rowTarget(node));
  });
  return nodeButton;
}

function wipeButton(parts: Parts, node: HTMLElement): HTMLElement {
  const from = node.dataset["from"] ?? "";
  const nodeButton = button("Usuń", "panel-redirect-delete");
  nodeButton.setAttribute("aria-label", `Usuń przekierowanie ${from}`);
  nodeButton.addEventListener("click", () => {
    void removeRoute(parts, from);
  });
  return nodeButton;
}

function rowTarget(node: HTMLElement): string {
  return node.querySelector<HTMLInputElement>(`[data-part="to"]`)?.value.trim() ?? "";
}

async function sendRoute(parts: Parts, from: string, to: string): Promise<void> {
  const target = usablePath(from);
  if (target === undefined || !to.startsWith("/")) {
    speak(parts.status, ["Ścieżka ma zaczynać się od „/”."]);
    return;
  }
  const response = await panelSend(
    "PUT",
    "/api/panel/redirects",
    redirectSave({ from: target, to }),
  );
  if (response.ok) {
    speak(parts.status, [`Przekierowanie ${target} zapisane.`]);
    await refreshRoutes(parts);
    return;
  }
  speak(parts.status, [problemPhrase(response.status)]);
}

async function removeRoute(parts: Parts, from: string): Promise<void> {
  const target = usablePath(from);
  if (target === undefined) {
    speak(parts.status, ["Ścieżka ma zaczynać się od „/”."]);
    return;
  }
  const response = await panelDelete(`/api/panel/redirects${target}`);
  if (!response.ok) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  speak(parts.status, [`Przekierowanie ${target} usunięte.`]);
  await refreshRoutes(parts);
}

async function refreshRoutes(parts: Parts): Promise<void> {
  speak(parts.status, ["Wczytywanie przekierowań…"]);
  const response = await panelRead("/api/panel/redirects");
  const list: PanelRedirectList | undefined = parse(PANEL_SCHEMAS.redirectList, response.data);
  if (list === undefined) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  parts.rows.replaceChildren(...list.items.map((target) => rowNode(parts, target)));
  speak(parts.status, [`Razem: ${String(list.items.length)} przekierowań.`]);
}

export function wirePrzekierowania(section: HTMLElement): void {
  const parts = partsFor(section);
  const view = gateView(section);
  parts.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void newRoute(parts);
  });
  wireShell(view, (role) => {
    if (role === "admin") {
      void refreshRoutes(parts);
      return;
    }
    denyContent(view);
  });
}

async function newRoute(parts: Parts): Promise<void> {
  const fromInput = parts.fromInput;
  const toInput = parts.toInput;
  const from = fromInput.value;
  const to = toInput.value.trim();
  await sendRoute(parts, from, to);
  if (to.startsWith("/")) {
    fromInput.value = "";
    toInput.value = "";
  }
}

const section = document.querySelector<HTMLElement>('[data-panel-page="redirects"]');

if (section !== null) {
  wirePrzekierowania(section);
}
