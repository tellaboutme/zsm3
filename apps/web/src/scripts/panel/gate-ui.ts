import { area, areaButton, el } from "./dom.ts";
import { panelRead } from "../../lib/panel/api.ts";
import { gateDecision, gatePhrases, rolePhrase, type GateState } from "../../lib/panel/gate.ts";
import { PANEL_SCHEMAS, parse, type PanelMe } from "../../lib/panel/models.ts";

export interface GateView {
  readonly app: HTMLElement;
  readonly gate: HTMLElement;
  readonly text: HTMLElement;
  readonly retry: HTMLButtonElement;
}

export type PanelEnter = (role: string, me: PanelMe | undefined) => void;

interface Frame {
  app: HTMLElement;
  gate: HTMLElement;
  text: HTMLElement;
  retry: HTMLButtonElement;
}

function frameOf(view: GateView): Frame {
  return { ...view };
}

function phraseNodes(state: GateState): readonly HTMLElement[] {
  const nodes = gatePhrases(state).map((phrase) => el("p", { text: phrase }));
  if (state === "denied") {
    nodes.push(el("a", { text: "Kontakt", attributes: { href: "/kontakt" } }));
  }
  return nodes;
}

function showGate(frame: Frame, state: GateState): void {
  const gate = frame.gate;
  const app = frame.app;
  const text = frame.text;
  gate.hidden = false;
  app.hidden = true;
  text.replaceChildren(...phraseNodes(state));
  frame.retry.focus();
}

async function readGate(): Promise<{ me: PanelMe | undefined; state: GateState }> {
  const response = await panelRead("/api/panel/me");
  const me = parse(PANEL_SCHEMAS.me, response.data);
  return { me, state: gateDecision(response.status, me?.email) };
}

async function attempt(frame: Frame, enter: PanelEnter): Promise<void> {
  const text = frame.text;
  const retry = frame.retry;
  text.replaceChildren(el("p", { text: gatePhrases("loading")[0] ?? "" }));
  retry.disabled = true;
  const { me, state } = await readGate();
  retry.disabled = false;
  const gate = frame.gate;
  const app = frame.app;
  if (state === "ready") {
    gate.hidden = true;
    app.hidden = false;
    enter(me?.role ?? "", me);
    return;
  }
  showGate(frame, state);
}

export function wireGate(view: GateView, enter: PanelEnter): void {
  const frame = frameOf(view);
  frame.retry.addEventListener("click", () => {
    void attempt(frame, enter);
  });
  void attempt(frame, enter);
}

export function denyContent(view: GateView): void {
  showGate(frameOf(view), "denied");
  area(document.body, "gate-retry").hidden = true;
}

export function userLine(me: PanelMe): string {
  const role = rolePhrase(me.role) ?? me.role;
  return `${me.email} — ${role}`;
}

export function gateView(section: HTMLElement): GateView {
  return {
    app: area(section, "app"),
    gate: area(section, "gate"),
    text: area(section, "gate-text"),
    retry: areaButton(section, "gate-retry"),
  };
}
