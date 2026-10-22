function bindOpeners(selector: string, dialog: HTMLDialogElement): void {
  for (const opener of document.querySelectorAll<HTMLElement>(selector)) {
    opener.addEventListener("click", () => {
      for (const other of document.querySelectorAll("dialog[open]")) {
        if (other instanceof HTMLDialogElement && other !== dialog) {
          other.close();
        }
      }
      dialog.showModal();
    });
  }
}

function bindClosing(dialog: HTMLDialogElement): void {
  for (const closer of dialog.querySelectorAll<HTMLElement>("[data-close-dialog]")) {
    closer.addEventListener("click", () => {
      dialog.close();
    });
  }
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
}

export function initDialogs(): void {
  const pairs = [
    ["[data-open-mobile-menu]", "[data-mobile-menu]"],
    ["[data-open-settings]", "[data-settings-dialog]"],
  ] as const;
  for (const [openerSelector, dialogSelector] of pairs) {
    const dialog = document.querySelector(dialogSelector);
    if (dialog instanceof HTMLDialogElement) {
      bindOpeners(openerSelector, dialog);
      bindClosing(dialog);
    }
  }
}
