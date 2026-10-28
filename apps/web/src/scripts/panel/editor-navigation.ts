export function revealEditor(section: HTMLElement): void {
  const list = section.querySelector<HTMLElement>('[data-panel="list"]');
  const editor = section.querySelector<HTMLElement>('[data-panel="editor"]');
  if (
    editor === null ||
    list?.getBoundingClientRect().left !== editor.getBoundingClientRect().left
  ) {
    return;
  }
  editor.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}
