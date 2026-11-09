const SELECTOR = "[data-scroll-region]";

function syncFocus(region: HTMLElement): void {
  if (region.scrollWidth > region.clientWidth + 1) {
    region.setAttribute("tabindex", "0");
  } else if (document.activeElement !== region) {
    region.removeAttribute("tabindex");
  }
}

export function initScrollRegions(): void {
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const region = entry.target.closest<HTMLElement>(SELECTOR);
      if (region !== null) {
        syncFocus(region);
      }
    }
  });
  for (const region of document.querySelectorAll<HTMLElement>(SELECTOR)) {
    observer.observe(region);
    for (const child of region.children) {
      observer.observe(child);
    }
    region.addEventListener("focusout", () => {
      requestAnimationFrame(() => {
        syncFocus(region);
      });
    });
  }
}
