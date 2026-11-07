import { panelPhotoUploadSchema } from "@zsm3/contracts/gallery";

import { areaButton, areaForm, area, areaInput, speak } from "./dom.ts";
import { preparePhoto } from "./photo-worker-client.ts";
import { CONNECTION_PHRASE, devAssertionHeaders } from "../../lib/panel/api.ts";
import {
  galleryProblemPhrase,
  photoFailurePhrase,
  sourceFilePhrase,
  uploadPercent,
} from "../../lib/panel/gallery.ts";
import { parse } from "../../lib/panel/models.ts";

interface Parts {
  readonly form: HTMLFormElement;
  readonly file: HTMLInputElement;
  readonly alt: HTMLTextAreaElement;
  readonly consent: HTMLInputElement;
  readonly send: HTMLButtonElement;
  readonly cancel: HTMLButtonElement;
  readonly status: HTMLElement;
  readonly progress: HTMLProgressElement;
}

interface PhotoBytes {
  readonly small: ArrayBuffer;
  readonly large: ArrayBuffer;
}

const noop = (): void => undefined;

function partsFor(section: HTMLElement): Parts {
  const form = areaForm(section, "photo-form");
  const alt = form.querySelector("textarea");
  const progress = form.querySelector("progress");
  if (alt === null || progress === null) {
    throw new Error("missing photo form field");
  }
  return {
    form,
    alt,
    progress,
    file: areaInput(form, "photo-file"),
    consent: areaInput(form, "photo-consent"),
    send: areaButton(form, "photo-send"),
    cancel: areaButton(form, "photo-cancel"),
    status: area(form, "photo-status"),
  };
}

function setBusy(parts: Parts, busy: boolean, onCancel: () => void): void {
  const { send, cancel, progress } = parts;
  send.disabled = busy;
  cancel.hidden = !busy;
  cancel.onclick = onCancel;
  progress.hidden = !busy;
}

function missingField(parts: Parts): { phrase: string; field: HTMLElement } | undefined {
  const file = parts.file.files?.[0];
  if (file === undefined) {
    return { phrase: "Wybierz zdjęcie.", field: parts.file };
  }
  const fileProblem = sourceFilePhrase(file.size);
  if (fileProblem !== undefined) {
    return { phrase: fileProblem, field: parts.file };
  }
  if (parts.alt.value.trim().length === 0) {
    return { phrase: "Opisz zdjęcie dla osób niewidomych.", field: parts.alt };
  }
  if (!parts.consent.checked) {
    return { phrase: "Potwierdź podstawę publikacji zdjęcia.", field: parts.consent };
  }
  return undefined;
}

function uploadBody(parts: Parts, bytes: PhotoBytes): FormData {
  const body = new FormData();
  body.append("small", new File([bytes.small], "small.webp", { type: "image/webp" }));
  body.append("large", new File([bytes.large], "large.webp", { type: "image/webp" }));
  body.append("alt", parts.alt.value);
  body.append("consent", "true");
  return body;
}

function savedPhrase(parts: Parts, response: unknown, status: number): string | undefined {
  const saved = parse(panelPhotoUploadSchema, response);
  if (saved === undefined) {
    speak(parts.status, [galleryProblemPhrase(status, response)]);
    return undefined;
  }
  parts.form.reset();
  return saved.duplicate ? "To zdjęcie jest już w tym albumie." : "Dodano zdjęcie do albumu.";
}

function sendPhoto(
  parts: Parts,
  albumId: string,
  bytes: PhotoBytes,
  afterSaved: () => void,
): XMLHttpRequest {
  const { progress } = parts;
  const xhr = new XMLHttpRequest();
  xhr.open("POST", `/api/panel/albums/${albumId}/photos`, true);
  for (const [name, value] of Object.entries(devAssertionHeaders())) {
    xhr.setRequestHeader(name, value);
  }
  xhr.responseType = "json";
  xhr.upload.addEventListener("progress", (event) => {
    progress.value = uploadPercent(event.loaded, event.total);
  });
  const finished = (phrase: string): void => {
    setBusy(parts, false, noop);
    speak(parts.status, [phrase]);
  };
  xhr.addEventListener("load", () => {
    setBusy(parts, false, noop);
    const phrase = savedPhrase(parts, xhr.response, xhr.status);
    if (phrase !== undefined) {
      speak(parts.status, [phrase]);
      afterSaved();
    }
  });
  xhr.addEventListener("error", () => {
    finished(CONNECTION_PHRASE);
  });
  xhr.addEventListener("abort", () => {
    finished("Anulowano wysyłanie.");
  });
  xhr.send(uploadBody(parts, bytes));
  return xhr;
}

async function submit(parts: Parts, albumId: string, afterSaved: () => void): Promise<void> {
  const missing = missingField(parts);
  const file = parts.file.files?.[0];
  if (missing !== undefined || file === undefined) {
    speak(parts.status, [missing?.phrase ?? ""]);
    missing?.field.focus();
    return;
  }
  const { progress, cancel } = parts;
  const preparation = preparePhoto(file);
  progress.removeAttribute("value");
  setBusy(parts, true, preparation.cancel);
  speak(parts.status, ["Przygotowuję zdjęcie…"]);
  const answer = await preparation.done;
  if (answer === undefined) {
    setBusy(parts, false, noop);
    speak(parts.status, ["Anulowano przygotowanie zdjęcia."]);
    return;
  }
  if (!answer.ok) {
    setBusy(parts, false, noop);
    speak(parts.status, [photoFailurePhrase(answer.failure)]);
    return;
  }
  speak(parts.status, ["Wysyłam zdjęcie…"]);
  progress.value = 0;
  const xhr = sendPhoto(parts, albumId, answer, afterSaved);
  cancel.onclick = () => {
    xhr.abort();
  };
}

export function wireUpload(section: HTMLElement, albumId: string, afterSaved: () => void): void {
  const parts = partsFor(section);
  parts.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submit(parts, albumId, afterSaved);
  });
}
