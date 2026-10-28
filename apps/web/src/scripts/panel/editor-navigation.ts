export function revealEditor(section: HTMLElement): void {
  if (!window.matchMedia("(width < 40rem)").matches) {
    return;
  }
  section.querySelector<HTMLElement>('[data-panel="editor"]')?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}
