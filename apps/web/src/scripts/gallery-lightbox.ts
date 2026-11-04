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

  constructor(parts: LightboxParts, links: readonly HTMLAnchorElement[]) {
    this.#parts = parts;
    this.#links = links;
  }

  bind(): void {
    this.#bindOpeners();
    this.#bindControls();
    this.#bindSwipe();
  }

  #zoomed(): boolean {
    return this.#parts.stage.classList.contains("zoomed");
  }

  #setZoom(zoomed: boolean): void {
    const { stage, zoom } = this.#parts;
    stage.classList.toggle("zoomed", zoomed);
    zoom.setAttribute("aria-pressed", String(zoomed));
    zoom.textContent = zoomed ? "Pomniejsz" : "Powiększ";
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
    this.#setZoom(false);
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
    const { dialog, close, previous, next, zoom, image } = this.#parts;
    close.addEventListener("click", () => {
      dialog.close();
    });
    dialog.addEventListener("close", () => {
      this.#setZoom(false);
      this.#opener?.focus();
    });
    previous.addEventListener("click", () => {
      this.#step(-1);
    });
    next.addEventListener("click", () => {
      this.#step(1);
    });
    for (const toggle of [zoom, image]) {
      toggle.addEventListener("click", () => {
        this.#setZoom(!this.#zoomed());
      });
    }
    dialog.addEventListener("keydown", (event) => {
      if (!this.#zoomed()) {
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
      if (this.#touchStart !== undefined && end !== undefined && !this.#zoomed()) {
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
