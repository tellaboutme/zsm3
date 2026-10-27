import { Window } from "happy-dom";

const panelWindow = new Window({ url: "http://panel.local/" });
const GLOBALS: readonly string[] = [
  "document",
  "Element",
  "HTMLElement",
  "HTMLFormElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "HTMLTextAreaElement",
  "HTMLButtonElement",
  "HTMLUListElement",
];

for (const name of GLOBALS) {
  Reflect.set(globalThis, name, Reflect.get(panelWindow, name));
}
