import "../../lib/panel/zod-jitless.ts";
import { panelAlbumViewSchema, type PanelAlbum, type PanelPhoto } from "@zsm3/contracts/gallery";

import { area, areaButton, areaForm, areaList, areaSelect, speak } from "./dom.ts";
import { wireAlbumActions, type AlbumActionParts } from "./galeria-album-actions.ts";
import {
  fillYearChoices,
  presentAlbumForm,
  removeAlbumControls,
  unsavedAlts,
} from "./galeria-album-form.ts";
import { photoRow } from "./galeria-photos.ts";
import { wireUpload } from "./galeria-upload.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { photoCountPhrase } from "../../lib/gallery.ts";
import { panelRead } from "../../lib/panel/api.ts";
import {
  albumIdFrom,
  albumStatePhrase,
  galleryProblemPhrase,
  photoRemovedPhrase,
  removalHidesAlbum,
  schoolYearChoices,
} from "../../lib/panel/gallery.ts";
import { canManageGallery } from "../../lib/panel/gate.ts";
import { latestOnly, type Ticket } from "../../lib/panel/latest.ts";
import { parse } from "../../lib/panel/models.ts";

interface Parts extends AlbumActionParts {
  readonly state: HTMLElement;
  readonly photos: HTMLUListElement;
  readonly nextLoad: () => Ticket;
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
          const after = await load(parts, false);
          if (typeof after === "string") {
            return;
          }
          const hidden = album.publishedAt !== null && after.publishedAt === null;
          speak(parts.status, [photoRemovedPhrase(hidden)]);
          parts.title.focus();
        },
      }),
    ),
  );
}

async function load(parts: Parts, withForm: boolean): Promise<PanelAlbum | "stale" | "failed"> {
  const current = parts.nextLoad();
  const response = await panelRead(`/api/panel/albums/${parts.id}`);
  if (!current()) {
    return "stale";
  }
  const view = parse(panelAlbumViewSchema, response.data);
  if (view === undefined) {
    speak(parts.status, [galleryProblemPhrase(response.status, response.data)]);
    return "failed";
  }
  if (withForm) {
    presentAlbumForm(parts, view.item);
  }
  present(parts, view.item, view.photos);
  return view.item;
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
    nextLoad: latestOnly(),
  };
  fillYearChoices(parts.year, schoolYearChoices(new Date()));
  wireAlbumActions(parts, async (withForm) => typeof (await load(parts, withForm)) !== "string");
  wireUpload(section, id, () => {
    void load(parts, false);
  });
  void load(parts, true).then((album) => {
    if (album === "failed") {
      removeAlbumControls(section);
    }
  });
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
      removeAlbumControls(section);
      speak(area(section, "status"), ["Nie znaleziono albumu. Wróć do listy."]);
      return;
    }
    wire(section, id);
  });
}
