import { albumInputSchema } from "@zsm3/contracts/gallery";

import { inputValue, speak } from "./dom.ts";
import { panelDelete, panelSend } from "../../lib/panel/api.ts";
import { galleryProblemPhrase } from "../../lib/panel/gallery.ts";

export interface AlbumActionParts {
  readonly id: string;
  readonly title: HTMLElement;
  readonly status: HTMLElement;
  readonly form: HTMLFormElement;
  readonly year: HTMLSelectElement;
  readonly description: HTMLTextAreaElement;
  readonly publish: HTMLButtonElement;
  readonly unpublish: HTMLButtonElement;
  readonly remove: HTMLButtonElement;
}

export type Reload = (withForm: boolean) => Promise<boolean>;

async function saveDetails(parts: AlbumActionParts, reload: Reload): Promise<void> {
  const input = albumInputSchema.safeParse({
    schoolYear: parts.year.value,
    slug: inputValue(parts.form, "slug"),
    title: inputValue(parts.form, "title"),
    description: parts.description.value,
  });
  if (!input.success) {
    speak(parts.status, ["Sprawdź tytuł i adres. Adres to małe litery, cyfry i myślniki."]);
    return;
  }
  const response = await panelSend("PUT", `/api/panel/albums/${parts.id}`, input.data);
  if (!response.ok) {
    speak(parts.status, [galleryProblemPhrase(response.status, response.data)]);
    return;
  }
  if (await reload(true)) {
    speak(parts.status, ["Zapisano album."]);
  }
}

async function setPublication(
  parts: AlbumActionParts,
  reload: Reload,
  action: "publish" | "unpublish",
): Promise<void> {
  const question =
    action === "publish"
      ? "Opublikować album? Wszystkie jego zdjęcia będą widoczne na stronie szkoły."
      : "Ukryć album? Zniknie ze strony szkoły.";
  if (!confirm(question)) {
    return;
  }
  const response = await panelSend("PATCH", `/api/panel/albums/${parts.id}`, { action });
  if (!response.ok) {
    speak(parts.status, [galleryProblemPhrase(response.status, response.data)]);
    return;
  }
  if (!(await reload(false))) {
    return;
  }
  speak(parts.status, [action === "publish" ? "Opublikowano album." : "Ukryto album."]);
  parts.title.focus();
}

async function removeAlbum(parts: AlbumActionParts): Promise<void> {
  if (!confirm("Usunąć album razem ze zdjęciami? Zniknie ze strony od razu.")) {
    return;
  }
  const response = await panelDelete(`/api/panel/albums/${parts.id}`);
  if (response.ok) {
    location.assign("/panel/galeria");
    return;
  }
  speak(parts.status, [galleryProblemPhrase(response.status, response.data)]);
}

export function wireAlbumActions(parts: AlbumActionParts, reload: Reload): void {
  parts.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveDetails(parts, reload);
  });
  parts.publish.addEventListener("click", () => {
    void setPublication(parts, reload, "publish");
  });
  parts.unpublish.addEventListener("click", () => {
    void setPublication(parts, reload, "unpublish");
  });
  parts.remove.addEventListener("click", () => {
    void removeAlbum(parts);
  });
}
