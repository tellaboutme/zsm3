const SELECTOR = "[data-scroll-region]";

function syncFocus(region: HTMLElement): void {
  if (region.scrollWidth > region.clientWidth + 1) {
    region.setAttribute("tabindex", "0");
  } else if (document.activeElement !== region) {
    region.removeAttribute("tabindex");
  }
}

export function initScrollRegions(): void {
  const regions = [...document.querySelectorAll<HTMLElement>(SELECTOR)];
  if (regions.length === 0) {
    return;
  }
  const observer = new ResizeObserver((entries) => {
    const changed = new Set(entries.map((entry) => entry.target.closest<HTMLElement>(SELECTOR)));
    for (const region of changed) {
      if (region !== null) {
        syncFocus(region);
      }
    }
  });
  for (const region of regions) {
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
