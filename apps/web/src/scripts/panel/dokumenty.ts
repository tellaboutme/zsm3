import "../../lib/panel/zod-jitless.ts";
import type { StoredFile } from "@zsm3/contracts/media";

import { area, areaButton, areaForm, el, speak } from "./dom.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { panelRead, problemPhrase } from "../../lib/panel/api.ts";
import { canEditContent } from "../../lib/panel/gate.ts";
import { PANEL_SCHEMAS, parse, type PanelFileList } from "../../lib/panel/models.ts";
import { bytesPhrase, checkUpload, uploadPhrase } from "../../lib/panel/uploads.ts";

interface Parts {
  readonly form: HTMLFormElement;
  readonly input: HTMLInputElement;
  readonly rows: HTMLUListElement;
  readonly status: HTMLElement;
  readonly progress: HTMLElement;
}

const FILE_FIELD = "file";

function partsFor(section: HTMLElement): Parts {
  const form = areaForm(section, "file-form");
  const input = pickInput(form, "file");
  return {
    form,
    input,
    rows: rowListOf(section),
    status: area(section, "status"),
    progress: area(section, "upload-status"),
  };
}

function pickInput(form: HTMLFormElement, name: string): HTMLInputElement {
  const node = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
  if (node === null) {
    throw new Error(`missing file input`);
  }
  return node;
}

function rowListOf(section: HTMLElement): HTMLUListElement {
  const node = area(section, "file-items");
  if (node instanceof HTMLUListElement) {
    return node;
  }
  throw new Error(`missing list [data-panel="file-items"]`);
}

function itemNode(item: StoredFile): HTMLElement {
  const meta = el("p", {
    className: "panel-meta",
    text: `${bytesPhrase(item.bytes)} · ${item.format.toUpperCase()}`,
  });
  const head = el("strong", { text: item.name });
  return el("li", { className: "panel-item", children: [meta, head] });
}

async function refreshFiles(parts: Parts): Promise<void> {
  speak(parts.status, ["Wczytywanie listy dokumentów…"]);
  const response = await panelRead("/api/panel/files");
  const list: PanelFileList | undefined = parse(PANEL_SCHEMAS.fileList, response.data);
  if (list === undefined) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  parts.rows.replaceChildren(...list.items.map(itemNode));
  speak(parts.status, [`Razem: ${String(list.items.length)} dokumentów.`]);
}

function chosen(part: Parts): File | undefined {
  return part.input.files?.[0];
}

function preCheck(parts: Parts): File | undefined {
  const file = chosen(parts);
  if (file === undefined) {
    speak(parts.status, ["Wybierz plik."]);
    return undefined;
  }
  const verdict = checkUpload(file.name, file.size);
  speak(parts.status, [uploadPhrase(verdict)]);
  if (!verdict.ok) {
    return undefined;
  }
  return file;
}

function progressLabel(loaded: number, total: number): string {
  const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
  return `Wysyłanie: ${String(percent)}%`;
}

function sendFile(parts: Parts, file: File): void {
  const body = new FormData();
  body.append(FILE_FIELD, file);
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/panel/files", true);
  xhr.responseType = "json";
  xhr.upload.addEventListener("progress", (event) => {
    speak(parts.progress, [progressLabel(event.loaded, event.total)]);
  });
  xhr.addEventListener("load", () => {
    afterUpload(parts, xhr);
  });
  xhr.addEventListener("error", () => {
    speak(parts.progress, ["Nie udało się wysłać pliku. Sprawdź połączenie."]);
  });
  xhr.send(body);
}

function afterUpload(parts: Parts, xhr: XMLHttpRequest): void {
  const item = uploadItem(xhr);
  if (xhr.status === 201 && item !== undefined) {
    speak(parts.progress, [`Przesłano ${item.name} na serwer.`]);
    void refreshFiles(parts);
    return;
  }
  speak(parts.progress, [problemPhrase(xhr.status)]);
}

function uploadItem(xhr: XMLHttpRequest): StoredFile | undefined {
  const payload = parse(PANEL_SCHEMAS.upload, xhr.response);
  return payload?.item;
}

export function wireDokumenty(section: HTMLElement): void {
  const parts = partsFor(section);
  parts.input.addEventListener("change", () => {
    preCheck(parts);
  });
  parts.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const file = preCheck(parts);
    if (file === undefined) {
      return;
    }
    sendFile(parts, file);
  });
  areaButton(section, "file-refresh").addEventListener("click", () => {
    void refreshFiles(parts);
  });
  void refreshFiles(parts);
}

const section = document.querySelector<HTMLElement>('[data-panel-page="files"]');

if (section !== null) {
  const view = gateView(section);
  wireShell(view, (role) => {
    if (!canEditContent(role)) {
      denyContent(view);
      return;
    }
    wireDokumenty(section);
  });
}
