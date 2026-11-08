import "../../lib/panel/zod-jitless.ts";
import {
  albumInputSchema,
  panelAlbumListSchema,
  panelAlbumSchema,
  type PanelAlbum,
} from "@zsm3/contracts/gallery";
import { z } from "zod";

import { area, areaForm, areaList, areaSelect, el, inputValue, speak } from "./dom.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { photoCountPhrase } from "../../lib/gallery.ts";
import { panelRead, panelSend } from "../../lib/panel/api.ts";
import {
  albumHref,
  albumStatePhrase,
  galleryProblemPhrase,
  schoolYearChoices,
  schoolYearOf,
} from "../../lib/panel/gallery.ts";
import { canManageGallery } from "../../lib/panel/gate.ts";
import { latestOnly, type Ticket } from "../../lib/panel/latest.ts";
import { parse } from "../../lib/panel/models.ts";
import { slugify } from "../../lib/panel/slug.ts";

const savedSchema = z.object({ item: panelAlbumSchema });

interface Parts {
  readonly rows: HTMLUListElement;
  readonly filter: HTMLSelectElement;
  readonly status: HTMLElement;
  readonly form: HTMLFormElement;
  readonly formStatus: HTMLElement;
  readonly nextRefresh: () => Ticket;
}

function albumRow(album: PanelAlbum): HTMLElement {
  return el("li", {
    className: "panel-item",
    children: [
      el("p", {
        className: "panel-meta",
        text: `${album.schoolYear} · ${albumStatePhrase(album.publishedAt)} · ${photoCountPhrase(album.photoCount)}`,
      }),
      el("a", { text: album.title, attributes: { href: albumHref(album.id) } }),
    ],
  });
}

async function refresh(parts: Parts): Promise<void> {
  const current = parts.nextRefresh();
  parts.rows.replaceChildren();
  speak(parts.status, ["Wczytywanie albumów…"]);
  const year = parts.filter.value;
  const query = year === "" ? "" : `?schoolYear=${encodeURIComponent(year)}`;
  const response = await panelRead(`/api/panel/albums${query}`);
  if (!current()) {
    return;
  }
  const list = parse(panelAlbumListSchema, response.data);
  if (list === undefined) {
    speak(parts.status, [galleryProblemPhrase(response.status, response.data)]);
    return;
  }
  parts.rows.replaceChildren(...list.items.map(albumRow));
  speak(parts.status, [
    list.items.length === 0 ? "Brak albumów." : `Albumów na liście: ${String(list.items.length)}.`,
  ]);
}

function fillYears(select: HTMLSelectElement, years: readonly string[]): void {
  for (const year of years) {
    select.append(el("option", { text: year, attributes: { value: year } }));
  }
}

async function create(parts: Parts): Promise<void> {
  const title = inputValue(parts.form, "title");
  const year = parts.form.querySelector<HTMLSelectElement>('[name="schoolYear"]')?.value;
  const input = albumInputSchema.safeParse({
    schoolYear: year,
    slug: slugify(title),
    title,
    description: inputValue(parts.form, "description"),
  });
  if (!input.success) {
    speak(parts.formStatus, ["Podaj tytuł z literami lub cyframi."]);
    return;
  }
  const response = await panelSend("POST", "/api/panel/albums", input.data);
  const saved = parse(savedSchema, response.data);
  if (saved === undefined) {
    speak(parts.formStatus, [galleryProblemPhrase(response.status, response.data)]);
    return;
  }
  location.assign(albumHref(saved.item.id));
}

function wire(section: HTMLElement): void {
  const parts: Parts = {
    rows: areaList(section, "album-rows"),
    filter: areaSelect(section, "album-filter"),
    status: area(section, "status"),
    form: areaForm(section, "album-form"),
    formStatus: area(section, "album-form-status"),
    nextRefresh: latestOnly(),
  };
  const today = new Date();
  const years = schoolYearChoices(today);
  fillYears(parts.filter, years);
  const yearSelect = areaSelect(section, "album-year");
  fillYears(yearSelect, years);
  yearSelect.value = schoolYearOf(today);
  parts.filter.addEventListener("change", () => {
    void refresh(parts);
  });
  parts.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void create(parts);
  });
  void refresh(parts);
}

const section = document.querySelector<HTMLElement>('[data-panel-page="gallery"]');

if (section !== null) {
  const view = gateView(section);
  wireShell(view, (role) => {
    if (!canManageGallery(role)) {
      denyContent(view);
      return;
    }
    wire(section);
  });
}
