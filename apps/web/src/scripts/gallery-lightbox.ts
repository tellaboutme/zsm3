import { PhotoZoom } from "./gallery-zoom-view.ts";
import { keyStep, steppedIndex, swipeStep } from "../lib/gallery.ts";

interface LightboxParts {
  readonly dialog: HTMLDialogElement;
  readonly stage: HTMLElement;
  readonly image: HTMLImageElement;
  readonly position: HTMLElement;
  readonly caption: HTMLElement;
  readonly status: HTMLElement;
  readonly zoom: HTMLButtonElement;
  readonly close: HTMLButtonElement;
  readonly previous: HTMLButtonElement;
  readonly next: HTMLButtonElement;
}

function part<T extends Element>(root: Element, name: string, type: new () => T): T {
  const found = root.querySelector(`[data-lightbox-${name}]`);
  if (!(found instanceof type)) {
    throw new TypeError(`Missing lightbox part: ${name}`);
  }
  return found;
}

function lightboxParts(dialog: HTMLDialogElement): LightboxParts {
  return {
    dialog,
    stage: part(dialog, "stage", HTMLDivElement),
    image: part(dialog, "image", HTMLImageElement),
    position: part(dialog, "position", HTMLParagraphElement),
    caption: part(dialog, "caption", HTMLParagraphElement),
    status: part(dialog, "status", HTMLParagraphElement),
    zoom: part(dialog, "zoom", HTMLButtonElement),
    close: part(dialog, "close", HTMLButtonElement),
    previous: part(dialog, "previous", HTMLButtonElement),
    next: part(dialog, "next", HTMLButtonElement),
  };
}

class Lightbox {
  readonly #parts: LightboxParts;
  readonly #links: readonly HTMLAnchorElement[];
  #current = 0;
  #opener: HTMLAnchorElement | undefined;
  #touchStart: number | undefined;
  readonly #zoom: PhotoZoom;

  constructor(parts: LightboxParts, links: readonly HTMLAnchorElement[]) {
    this.#parts = parts;
    this.#links = links;
    this.#zoom = new PhotoZoom(parts.stage, parts.image, parts.zoom, parts.close);
  }

  bind(): void {
    this.#zoom.bind();
    this.#bindOpeners();
    this.#bindControls();
    this.#bindSwipe();
  }

  #show(link: HTMLAnchorElement, index: number, announce: boolean): void {
    const { image, position, caption, previous, next, status } = this.#parts;
    const alt = link.querySelector("img")?.alt ?? "";
    const place = link.dataset["position"] ?? "";
    this.#current = index;
    image.src = link.href;
    image.alt = alt;
    image.width = Number(link.dataset["width"]);
    image.height = Number(link.dataset["height"]);
    position.textContent = place;
    caption.textContent = alt;
    previous.disabled = index === 0;
    next.disabled = index === this.#links.length - 1;
    this.#zoom.reset();
    status.textContent = announce ? `${place}. ${alt}` : "";
  }

  #step(by: number): void {
    const target = steppedIndex(this.#current, by, this.#links.length);
    const link = target === undefined ? undefined : this.#links[target];
    if (target === undefined || link === undefined) {
      return;
    }
    const { previous, next } = this.#parts;
    this.#show(link, target, true);
    if ((by < 0 ? previous : next).disabled) {
      (by < 0 ? next : previous).focus();
    }
  }

  #bindOpeners(): void {
    const { dialog, close } = this.#parts;
    this.#links.forEach((link, index) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        this.#opener = link;
        this.#show(link, index, false);
        dialog.showModal();
        close.focus();
      });
    });
  }

  #bindControls(): void {
    const { dialog, close, previous, next } = this.#parts;
    close.addEventListener("click", () => {
      dialog.close();
    });
    dialog.addEventListener("close", () => {
      this.#zoom.reset();
      this.#opener?.focus();
    });
    previous.addEventListener("click", () => {
      this.#step(-1);
    });
    next.addEventListener("click", () => {
      this.#step(1);
    });
    dialog.addEventListener("keydown", (event) => {
      if (!this.#zoom.active) {
        this.#step(keyStep(event.key));
      }
    });
  }

  #bindSwipe(): void {
    const { stage } = this.#parts;
    stage.addEventListener(
      "touchstart",
      (event) => {
        this.#touchStart = event.touches[0]?.clientX;
      },
      { passive: true },
    );
    stage.addEventListener("touchend", (event) => {
      const end = event.changedTouches[0]?.clientX;
      if (this.#touchStart !== undefined && end !== undefined && !this.#zoom.active) {
        this.#step(swipeStep(end - this.#touchStart));
      }
      this.#touchStart = undefined;
    });
  }
}

export function initLightbox(): void {
  const dialog = document.querySelector("[data-lightbox]");
  if (dialog instanceof HTMLDialogElement) {
    const links = [...document.querySelectorAll<HTMLAnchorElement>("a[data-gallery-photo]")];
    new Lightbox(lightboxParts(dialog), links).bind();
  }
}
