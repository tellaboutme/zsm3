import { panelShortLinkCreatedSchema, type PanelShortLinkItem } from "@zsm3/contracts/panel";

import { area, areaButton, areaForm, areaInput, speak } from "./dom.ts";
import { CONNECTION_PHRASE, devAssertionHeaders, panelSend } from "../../lib/panel/api.ts";
import { parse } from "../../lib/panel/models.ts";
import {
  checkLinkFile,
  createPhrase,
  fileCheckPhrase,
  LINK_FILES_PATH,
  LINKS_PATH,
  schoolYearNote,
  shortUrl,
} from "../../lib/panel/short-links.ts";

export type Created = (item: PanelShortLinkItem) => void;

interface FormParts {
  readonly form: HTMLFormElement;
  readonly targetField: HTMLElement;
  readonly fileField: HTMLElement;
  readonly target: HTMLInputElement;
  readonly file: HTMLInputElement;
  readonly password: HTMLInputElement;
  readonly status: HTMLElement;
  readonly submit: HTMLButtonElement;
  readonly result: HTMLElement;
  readonly resultTitle: HTMLElement;
  readonly resultUrl: HTMLInputElement;
}

function fieldOf(form: HTMLFormElement, name: string): HTMLInputElement {
  const node = form.elements.namedItem(name);
  if (node instanceof HTMLInputElement) {
    return node;
  }
  throw new Error(`missing field ${name}`);
}

function partsFor(section: HTMLElement): FormParts {
  const form = areaForm(section, "link-form");
  return {
    form,
    targetField: area(section, "link-target-field"),
    fileField: area(section, "link-file-field"),
    target: fieldOf(form, "target"),
    file: fieldOf(form, "file"),
    password: fieldOf(form, "password"),
    status: area(section, "link-status"),
    submit: areaButton(section, "link-submit"),
    result: area(section, "link-result"),
    resultTitle: area(section, "link-result-title"),
    resultUrl: areaInput(section, "link-result-url"),
  };
}

function fileMode(parts: FormParts): boolean {
  return new FormData(parts.form).get("kind") === "file";
}

function showKind(parts: FormParts): void {
  const file = fileMode(parts);
  parts.targetField.toggleAttribute("hidden", file);
  parts.fileField.toggleAttribute("hidden", !file);
  parts.target.removeAttribute("aria-invalid");
  speak(parts.status, []);
}

function passwordValue(parts: FormParts): string | undefined {
  return parts.password.value === "" ? undefined : parts.password.value;
}

function refuse(parts: FormParts, field: HTMLInputElement, phrase: string): void {
  field.setAttribute("aria-invalid", "true");
  speak(parts.status, [phrase]);
  field.focus();
}

class LinkForm {
  private readonly parts: FormParts;

  private readonly created: Created;

  constructor(parts: FormParts, created: Created) {
    this.parts = parts;
    this.created = created;
  }

  async submit(): Promise<void> {
    const { parts } = this;
    parts.target.removeAttribute("aria-invalid");
    parts.file.removeAttribute("aria-invalid");
    if (fileMode(parts)) {
      this.sendFile();
      return;
    }
    const target = parts.target.value.trim();
    if (target === "") {
      refuse(parts, parts.target, "Wpisz adres strony, do której ma prowadzić link.");
      return;
    }
    this.busy(true);
    const password = passwordValue(parts);
    const response = await panelSend(
      "POST",
      LINKS_PATH,
      password === undefined ? { target } : { target, password },
    );
    this.finish(response.status, response.data);
  }

  private sendFile(): void {
    const { parts } = this;
    const file = parts.file.files?.[0];
    if (file === undefined) {
      refuse(parts, parts.file, "Wybierz plik do udostępnienia.");
      return;
    }
    const check = checkLinkFile(file.name, file.size);
    if (!check.ok) {
      refuse(parts, parts.file, fileCheckPhrase(check));
      return;
    }
    this.upload(file);
  }

  private upload(file: File): void {
    const body = new FormData();
    body.append("file", file);
    body.append("password", passwordValue(this.parts) ?? "");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", LINK_FILES_PATH, true);
    xhr.responseType = "json";
    for (const [name, value] of Object.entries(devAssertionHeaders())) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.addEventListener("progress", (event) => {
      const percent = event.total > 0 ? Math.round((event.loaded / event.total) * 100) : 0;
      speak(this.parts.status, [`Wysyłanie pliku: ${String(percent)}%`]);
    });
    xhr.addEventListener("load", () => {
      this.finish(xhr.status, xhr.response);
    });
    xhr.addEventListener("error", () => {
      this.busy(false);
      speak(this.parts.status, [CONNECTION_PHRASE]);
    });
    this.busy(true);
    xhr.send(body);
  }

  private busy(active: boolean): void {
    this.parts.submit.disabled = active;
    this.parts.form.setAttribute("aria-busy", String(active));
    if (active) {
      speak(this.parts.status, ["Tworzę link…"]);
    }
  }

  private finish(status: number, data: unknown): void {
    const { parts } = this;
    this.busy(false);
    const created = status === 201 ? parse(panelShortLinkCreatedSchema, data) : undefined;
    if (created === undefined) {
      speak(parts.status, [createPhrase(status)]);
      return;
    }
    parts.form.reset();
    showKind(parts);
    parts.result.hidden = false;
    parts.resultUrl.value = shortUrl(window.location.origin, created.item.code);
    speak(parts.status, ["Link utworzony. Skopiuj go i przekaż uczniom."]);
    parts.resultTitle.focus();
    this.created(created.item);
  }
}

export async function copyLink(
  url: string,
  field: HTMLInputElement | null,
  status: HTMLElement,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    speak(status, ["Skopiowano link do schowka."]);
  } catch {
    field?.select();
    speak(status, [
      "Nie udało się skopiować automatycznie. Zaznacz link i skopiuj go skrótem Ctrl+C.",
    ]);
  }
}

export function wireLinkForm(section: HTMLElement, created: Created): void {
  const parts = partsFor(section);
  const form = new LinkForm(parts, created);
  area(section, "link-expiry").textContent = schoolYearNote(new Date());
  for (const radio of parts.form.querySelectorAll<HTMLInputElement>('input[name="kind"]')) {
    radio.addEventListener("change", () => {
      showKind(parts);
    });
  }
  parts.file.addEventListener("change", () => {
    const file = parts.file.files?.[0];
    speak(
      parts.status,
      file === undefined ? [] : [fileCheckPhrase(checkLinkFile(file.name, file.size))],
    );
  });
  parts.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void form.submit();
  });
  areaButton(section, "link-result-copy").addEventListener("click", () => {
    void copyLink(parts.resultUrl.value, parts.resultUrl, parts.status);
  });
}
