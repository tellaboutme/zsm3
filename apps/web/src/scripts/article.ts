import { flash } from "./feedback.ts";

function initCopyLink(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-copy-link]");
  const status = document.querySelector("[data-copy-status]");
  if (button === null || status === null || !("clipboard" in navigator)) {
    return;
  }
  button.hidden = false;
  button.addEventListener("click", () => {
    navigator.clipboard.writeText(location.href).then(
      () => {
        status.textContent = "Link skopiowany do schowka.";
        flash(button, "done", "Link skopiowany");
      },
      () => {
        status.textContent = "Nie udało się skopiować linku. Skopiuj adres z paska przeglądarki.";
        flash(button, "failed", "Nie udało się skopiować");
      },
    );
  });
}

initCopyLink();
