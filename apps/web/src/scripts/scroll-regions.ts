function syncFocus(region: HTMLElement): void {
  if (region.scrollWidth > region.clientWidth + 1) {
    region.setAttribute("tabindex", "0");
  } else if (document.activeElement !== region) {
    region.removeAttribute("tabindex");
  }
}

export function initScrollRegions(): void {
  for (const region of document.querySelectorAll<HTMLElement>("[data-scroll-region]")) {
    const observer = new ResizeObserver(() => {
      syncFocus(region);
    });
    observer.observe(region);
    for (const child of region.children) {
      observer.observe(child);
    }
  }
}
