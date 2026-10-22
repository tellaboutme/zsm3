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
      },
      () => {
        status.textContent = "Nie udało się skopiować linku. Skopiuj adres z paska przeglądarki.";
      },
    );
  });
}

initCopyLink();
