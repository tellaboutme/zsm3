function panelOf(toggle: HTMLButtonElement): HTMLElement | null {
  return document.getElementById(toggle.getAttribute("aria-controls") ?? "");
}

function setOpen(toggle: HTMLButtonElement, open: boolean): void {
  toggle.setAttribute("aria-expanded", String(open));
  panelOf(toggle)?.toggleAttribute("hidden", !open);
}

export function initMegaMenus(): void {
  const nav = document.querySelector<HTMLElement>("[data-primary-nav]");
  if (nav === null) {
    return;
  }
  const toggles = [...nav.querySelectorAll<HTMLButtonElement>("[data-menu-toggle]")];
  const openToggle = (): HTMLButtonElement | undefined =>
    toggles.find((toggle) => toggle.getAttribute("aria-expanded") === "true");
  const closeAll = (): void => {
    for (const toggle of toggles) {
      setOpen(toggle, false);
    }
  };

  for (const toggle of toggles) {
    toggle.addEventListener("click", () => {
      const wasOpen = toggle.getAttribute("aria-expanded") === "true";
      closeAll();
      setOpen(toggle, !wasOpen);
    });
  }
  document.addEventListener("keydown", (event) => {
    const current = openToggle();
    if (event.key === "Escape" && current !== undefined) {
      setOpen(current, false);
      current.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (event.target instanceof Node && !nav.contains(event.target)) {
      closeAll();
    }
  });
  document.addEventListener("focusin", (event) => {
    if (event.target instanceof Node && !nav.contains(event.target)) {
      closeAll();
    }
  });
}
