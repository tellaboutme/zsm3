import { isFieldFilter, matchesField } from "../lib/professions.ts";
import { isSchoolFilter, matchesSchool } from "../lib/programmes.ts";

function checkedValue(form: HTMLElement, name: string): string | undefined {
  return form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
}

function initProgrammeFilters(): void {
  const form = document.querySelector<HTMLElement>('[data-filters="programmes"]');
  const status = document.querySelector("[data-filter-status]");
  const empty = document.querySelector<HTMLElement>("[data-no-programmes]");
  if (form === null || status === null || empty === null) {
    return;
  }
  const tiles = [...document.querySelectorAll<HTMLElement>(".tile[data-school]")];
  const update = (): void => {
    const field = checkedValue(form, "branza");
    const school = checkedValue(form, "szkola");
    if (!isFieldFilter(field) || !isSchoolFilter(school)) {
      return;
    }
    const shown = tiles.filter(
      (tile) =>
        matchesField(tile.dataset["field"], field) && matchesSchool(tile.dataset["school"], school),
    ).length;
    status.textContent = `Pokazano kierunki: ${String(shown)} z ${String(tiles.length)}`;
    empty.hidden = shown > 0;
  };
  const selectFromHash = (): void => {
    const value = decodeURIComponent(location.hash.slice(1));
    const input = [...form.querySelectorAll<HTMLInputElement>("input[type=radio]")].find(
      (radio) => radio.value === value,
    );
    if (input !== undefined) {
      input.checked = true;
      update();
    }
  };
  form.addEventListener("change", update);
  window.addEventListener("hashchange", selectFromHash);
  selectFromHash();
}

initProgrammeFilters();
