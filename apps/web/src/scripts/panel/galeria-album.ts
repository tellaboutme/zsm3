import "../../lib/panel/zod-jitless.ts";
import {
  albumInputSchema,
  panelAlbumViewSchema,
  type PanelAlbum,
  type PanelPhoto,
} from "@zsm3/contracts/gallery";

import { area, areaButton, areaForm, areaList, areaSelect, el, inputValue, speak } from "./dom.ts";
import { presentAlbumForm, unsavedAlts } from "./galeria-album-form.ts";
import { photoRow } from "./galeria-photos.ts";
import { wireUpload } from "./galeria-upload.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { photoCountPhrase } from "../../lib/gallery.ts";
import { panelDelete, panelRead, panelSend } from "../../lib/panel/api.ts";
import {
  albumIdFrom,
  albumStatePhrase,
  galleryProblemPhrase,
  photoRemovedPhrase,
  removalHidesAlbum,
  schoolYearChoices,
} from "../../lib/panel/gallery.ts";
import { canManageGallery } from "../../lib/panel/gate.ts";
import { parse } from "../../lib/panel/models.ts";

interface Parts {
  readonly id: string;
  readonly title: HTMLElement;
  readonly state: HTMLElement;
  readonly status: HTMLElement;
  readonly form: HTMLFormElement;
  readonly year: HTMLSelectElement;
  readonly description: HTMLTextAreaElement;
  readonly publish: HTMLButtonElement;
  readonly unpublish: HTMLButtonElement;
  readonly remove: HTMLButtonElement;
  readonly photos: HTMLUListElement;
}

function present(parts: Parts, album: PanelAlbum, photos: readonly PanelPhoto[]): void {
  const { title, state, publish, unpublish } = parts;
  title.textContent = album.title;
  document.title = `${album.title} — galeria — ZSM3`;
  state.textContent = `${album.schoolYear} · ${albumStatePhrase(album.publishedAt)} · ${photoCountPhrase(album.photoCount)}`;
  publish.hidden = album.publishedAt !== null;
  unpublish.hidden = album.publishedAt === null;
  const hidesAlbum = removalHidesAlbum(album.publishedAt, album.photoCount);
  const drafts = unsavedAlts(parts.photos);
  parts.photos.replaceChildren(
    ...photos.map((photo, index) =>
      photoRow({
        albumId: parts.id,
        photo,
        index,
        hidesAlbum,
        draft: drafts.get(photo.id),
        say: (phrase) => {
          speak(parts.status, [phrase]);
        },
        afterRemoved: async () => {
          await load(parts, false);
          speak(parts.status, [photoRemovedPhrase(hidesAlbum)]);
          parts.title.focus();
        },
      }),
    ),
  );
}

async function load(parts: Parts, withForm: boolean): Promise<boolean> {
  const response = await panelRead(`/api/panel/albums/${parts.id}`);
  const view = parse(panelAlbumViewSchema, response.data);
  if (view === undefined) {
    speak(parts.status, [galleryProblemPhrase(response.status, response.data)]);
    return false;
  }
  if (withForm) {
    presentAlbumForm(parts, view.item);
  }
  present(parts, view.item, view.photos);
  return true;
}

async function saveDetails(parts: Parts): Promise<void> {
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
  await load(parts, true);
  speak(parts.status, ["Zapisano album."]);
}

async function setPublication(parts: Parts, action: "publish" | "unpublish"): Promise<void> {
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
  await load(parts, false);
  speak(parts.status, [action === "publish" ? "Opublikowano album." : "Ukryto album."]);
  parts.title.focus();
}

async function removeAlbum(parts: Parts): Promise<void> {
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

function wire(section: HTMLElement, id: string): void {
  const form = areaForm(section, "album-form");
  const description = form.querySelector("textarea");
  if (description === null) {
    throw new Error("missing album description");
  }
  const parts: Parts = {
    id,
    form,
    description,
    title: area(section, "album-title"),
    state: area(section, "album-state"),
    status: area(section, "status"),
    year: areaSelect(form, "album-year"),
    publish: areaButton(section, "album-publish"),
    unpublish: areaButton(section, "album-unpublish"),
    remove: areaButton(section, "album-remove"),
    photos: areaList(section, "photo-rows"),
  };
  for (const year of schoolYearChoices(new Date())) {
    parts.year.append(el("option", { text: year, attributes: { value: year } }));
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveDetails(parts);
  });
  parts.publish.addEventListener("click", () => {
    void setPublication(parts, "publish");
  });
  parts.unpublish.addEventListener("click", () => {
    void setPublication(parts, "unpublish");
  });
  parts.remove.addEventListener("click", () => {
    void removeAlbum(parts);
  });
  wireUpload(section, id, () => {
    void load(parts, false);
  });
  void load(parts, true);
}

const section = document.querySelector<HTMLElement>('[data-panel-page="gallery-album"]');

if (section !== null) {
  const view = gateView(section);
  wireShell(view, (role) => {
    if (!canManageGallery(role)) {
      denyContent(view);
      return;
    }
    const id = albumIdFrom(location.search);
    if (id === undefined) {
      areaForm(section, "album-form").remove();
      areaForm(section, "photo-form").remove();
      areaButton(section, "album-remove").remove();
      speak(area(section, "status"), ["Nie znaleziono albumu. Wróć do listy."]);
      return;
    }
    wire(section, id);
  });
}
