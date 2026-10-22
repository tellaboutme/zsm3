import { isAudienceFilter, isKindFilter, matchesCalendarFilter } from "../lib/calendar.ts";

function checkedValue(form: HTMLElement, name: string): string | undefined {
  return form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
}

function initCalendarFilters(): void {
  const form = document.querySelector<HTMLElement>('[data-filters="calendar"]');
  const status = document.querySelector("[data-filter-status]");
  const empty = document.querySelector<HTMLElement>("[data-no-matches]");
  if (form === null || status === null || empty === null) {
    return;
  }
  const months = [...document.querySelectorAll<HTMLElement>("[data-month]")];
  const update = (): void => {
    const audience = checkedValue(form, "dla");
    const kind = checkedValue(form, "rodzaj");
    if (!isAudienceFilter(audience) || !isKindFilter(kind)) {
      return;
    }
    let shown = 0;
    for (const month of months) {
      const visible = [...month.querySelectorAll<HTMLElement>(".event")].filter((event) =>
        matchesCalendarFilter(
          { audience: event.dataset["audience"], kind: event.dataset["kind"] },
          audience,
          kind,
        ),
      ).length;
      month.hidden = visible === 0;
      shown += visible;
    }
    status.textContent = `Pokazano terminy: ${String(shown)}`;
    empty.hidden = shown > 0;
  };
  form.addEventListener("change", update);
}

initCalendarFilters();
