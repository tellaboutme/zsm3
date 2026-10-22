import { isSignerFilter, matchesSigner } from "../lib/documents.ts";

function initDocumentFilter(): void {
  const form = document.querySelector<HTMLElement>('[data-filters="documents"]');
  const status = document.querySelector("[data-filter-status]");
  if (form === null || status === null) {
    return;
  }
  const groups = [...document.querySelectorAll<HTMLElement>("[data-document-group]")];
  form.addEventListener("change", () => {
    const signer = form.querySelector<HTMLInputElement>('input[name="kto"]:checked')?.value;
    if (!isSignerFilter(signer)) {
      return;
    }
    let shown = 0;
    for (const group of groups) {
      const visible = [...group.querySelectorAll<HTMLElement>("[data-signer]")].filter((row) =>
        matchesSigner(row.dataset["signer"], signer),
      ).length;
      group.hidden = visible === 0;
      shown += visible;
    }
    status.textContent = `Pokazano formularze: ${String(shown)}`;
  });
}

initDocumentFilter();
