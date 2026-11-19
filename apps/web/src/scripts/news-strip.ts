import { stripCount, stripTarget, stripWindow, type StripWindow } from "../lib/news-strip.ts";

const SETTLE_MS = 600;

interface Strip {
  readonly track: HTMLElement;
  readonly count: HTMLElement;
  readonly prev: HTMLButtonElement;
  readonly next: HTMLButtonElement;
}

function measure(track: HTMLElement): StripWindow {
  const [first, second] = track.children;
  const width = first instanceof HTMLElement ? first.offsetWidth : track.clientWidth;
  const step =
    first instanceof HTMLElement && second instanceof HTMLElement
      ? second.offsetLeft - first.offsetLeft
      : track.clientWidth;
  return stripWindow({
    scrollLeft: track.scrollLeft,
    step,
    viewport: track.clientWidth,
    gap: step - width,
    maxScroll: track.scrollWidth - track.clientWidth,
    total: track.children.length,
  });
}

function render({ track, count, prev, next }: Strip): void {
  const view = measure(track);
  const counter = count;
  counter.textContent = stripCount(view, track.children.length);
  prev.toggleAttribute("disabled", view.atStart);
  next.toggleAttribute("disabled", view.atEnd);
}

function bindArrows(strip: Strip): void {
  const { track } = strip;
  let pending: number | undefined;
  let settle = 0;
  const go = (direction: -1 | 1): void => {
    pending = stripTarget(pending ?? measure(track).first, direction, track.children.length);
    const target = track.children[pending];
    const start = track.children[0];
    if (target instanceof HTMLElement && start instanceof HTMLElement) {
      track.scrollTo({ left: target.offsetLeft - start.offsetLeft });
    }
    window.clearTimeout(settle);
    settle = window.setTimeout(() => {
      pending = undefined;
      render(strip);
    }, SETTLE_MS);
  };
  strip.prev.addEventListener("click", () => {
    go(-1);
  });
  strip.next.addEventListener("click", () => {
    go(1);
  });
}

function bindScroll(strip: Strip): void {
  let queued = false;
  strip.track.addEventListener(
    "scroll",
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          render(strip);
        });
      }
    },
    { passive: true },
  );
  new ResizeObserver(() => {
    render(strip);
  }).observe(strip.track);
}

export function initNewsStrips(): void {
  for (const root of document.querySelectorAll<HTMLElement>("[data-news-strip]")) {
    const track = root.querySelector<HTMLElement>("[data-strip-track]");
    const nav = root.querySelector<HTMLElement>("[data-strip-nav]");
    const count = root.querySelector<HTMLElement>("[data-strip-count]");
    const prev = root.querySelector<HTMLButtonElement>("[data-strip-prev]");
    const next = root.querySelector<HTMLButtonElement>("[data-strip-next]");
    if (track !== null && nav !== null && count !== null && prev !== null && next !== null) {
      nav.hidden = false;
      const strip = { track, count, prev, next };
      bindArrows(strip);
      bindScroll(strip);
      render(strip);
    }
  }
}
