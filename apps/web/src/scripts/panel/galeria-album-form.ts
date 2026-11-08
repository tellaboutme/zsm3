import type { PanelAlbum } from "@zsm3/contracts/gallery";

import { areaButton, areaForm, el, setInputValue } from "./dom.ts";

export interface AlbumFormFields {
  readonly form: HTMLFormElement;
  readonly year: HTMLSelectElement;
  readonly description: HTMLTextAreaElement;
}

export function presentAlbumForm(fields: AlbumFormFields, album: PanelAlbum): void {
  const { form, year, description } = fields;
  setInputValue(form, "title", album.title);
  setInputValue(form, "slug", album.slug);
  if (![...year.options].some((option) => option.value === album.schoolYear)) {
    year.append(el("option", { text: album.schoolYear, attributes: { value: album.schoolYear } }));
  }
  year.value = album.schoolYear;
  description.value = album.description;
}

export function unsavedAlts(list: HTMLUListElement): ReadonlyMap<string, string> {
  const drafts = new Map<string, string>();
  for (const row of list.querySelectorAll<HTMLElement>("[data-photo-id]")) {
    const alt = row.querySelector("textarea");
    const id = row.dataset["photoId"];
    if (alt !== null && id !== undefined && alt.value !== alt.defaultValue) {
      drafts.set(id, alt.value);
    }
  }
  return drafts;
}

export function fillYearChoices(select: HTMLSelectElement, years: readonly string[]): void {
  for (const year of years) {
    select.append(el("option", { text: year, attributes: { value: year } }));
  }
}

export function removeAlbumControls(section: HTMLElement): void {
  areaForm(section, "album-form").remove();
  areaForm(section, "photo-form").remove();
  areaButton(section, "album-remove").remove();
}
