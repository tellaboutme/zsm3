import { photoAltSchema, type PanelPhoto } from "@zsm3/contracts/gallery";

import { button, el } from "./dom.ts";
import { panelSend } from "../../lib/panel/api.ts";
import { galleryProblemPhrase } from "../../lib/panel/gallery.ts";

export interface PhotoRowInput {
  readonly albumId: string;
  readonly photo: PanelPhoto;
  readonly index: number;
  readonly say: (phrase: string) => void;
  readonly afterRemoved: () => Promise<void>;
}

function photoPath({ albumId, photo }: PhotoRowInput): string {
  return `/api/panel/albums/${albumId}/photos/${photo.id}`;
}

async function saveAlt(row: PhotoRowInput, value: string): Promise<void> {
  const input = photoAltSchema.safeParse({ alt: value });
  if (!input.success) {
    row.say("Opis zdjęcia nie może być pusty.");
    return;
  }
  const response = await panelSend("PATCH", photoPath(row), input.data);
  row.say(response.ok ? "Zapisano opis." : galleryProblemPhrase(response.status, response.data));
}

async function removePhoto(row: PhotoRowInput): Promise<void> {
  if (!confirm(`Usunąć to zdjęcie z albumu? Zniknie ze strony od razu.\n\n${row.photo.alt}`)) {
    return;
  }
  const response = await panelSend("DELETE", photoPath(row), {});
  if (!response.ok) {
    row.say(galleryProblemPhrase(response.status, response.data));
    return;
  }
  await row.afterRemoved();
}

export function photoRow(row: PhotoRowInput): HTMLElement {
  const { photo, index } = row;
  const number = String(index + 1);
  const alt = document.createElement("textarea");
  alt.rows = 2;
  alt.maxLength = 300;
  alt.value = photo.alt;
  const save = button(`Zapisz opis zdjęcia ${number}`);
  save.addEventListener("click", () => {
    void saveAlt(row, alt.value);
  });
  const remove = button(`Usuń zdjęcie ${number}`);
  remove.addEventListener("click", () => {
    void removePhoto(row);
  });
  const field = document.createElement("label");
  field.append(`Opis zdjęcia ${number}`, alt);
  return el("li", {
    className: "panel-photo-row",
    children: [
      el("p", {
        className: "panel-meta",
        text: `${String(photo.width)} × ${String(photo.height)} px · podstawę potwierdził(a) ${photo.consentBy}`,
      }),
      field,
      el("div", { className: "panel-actions", children: [save, remove] }),
    ],
  });
}
