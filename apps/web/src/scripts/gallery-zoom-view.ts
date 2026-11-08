import { bindDragPan } from "./gallery-pan.ts";
import { anchorFraction, anchoredScroll, type Size, zoomedSize } from "../lib/gallery-zoom.ts";

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Focus {
  readonly fx: number;
  readonly fy: number;
  readonly ox: number | undefined;
  readonly oy: number | undefined;
}

export class PhotoZoom {
  readonly #stage: HTMLElement;
  readonly #image: HTMLImageElement;
  readonly #button: HTMLButtonElement;
  readonly #wasDragged: () => boolean;

  constructor(stage: HTMLElement, image: HTMLImageElement, button: HTMLButtonElement) {
    this.#stage = stage;
    this.#image = image;
    this.#button = button;
    this.#wasDragged = bindDragPan(stage, () => this.active);
  }

  get active(): boolean {
    return this.#stage.classList.contains("zoomed");
  }

  bind(): void {
    this.#button.addEventListener("click", () => {
      this.#toggle(undefined);
    });
    this.#image.addEventListener("click", (event) => {
      if (!this.#wasDragged()) {
        this.#toggle({ x: event.clientX, y: event.clientY });
      }
    });
    this.#image.addEventListener("load", () => {
      this.#refresh();
    });
    new ResizeObserver(() => {
      this.#refit();
    }).observe(this.#stage);
  }

  reset(): void {
    this.#leave();
    this.#refresh();
  }

  #toggle(point: Point | undefined): void {
    if (this.active) {
      this.reset();
      return;
    }
    const fit = this.#image.getBoundingClientRect();
    const box = this.#viewport();
    const x = point?.x ?? fit.left + fit.width / 2;
    const y = point?.y ?? fit.top + fit.height / 2;
    this.#enter(fit, {
      fx: anchorFraction(x, fit.left, fit.width),
      fy: anchorFraction(y, fit.top, fit.height),
      ox: x - box.x,
      oy: y - box.y,
    });
  }

  #viewport(): Point {
    const outer = this.#stage.getBoundingClientRect();
    return { x: outer.left + this.#stage.clientLeft, y: outer.top + this.#stage.clientTop };
  }

  #natural(): Size {
    return { width: this.#image.naturalWidth, height: this.#image.naturalHeight };
  }

  #enter(fit: Size, focus: Focus): void {
    const target = zoomedSize(fit, this.#natural());
    if (target !== undefined) {
      this.#stage.classList.add("zoomed");
      this.#image.style.setProperty("width", `${String(target.width)}px`);
      const { clientWidth, clientHeight } = this.#stage;
      this.#stage.scrollTo({
        left: anchoredScroll(focus.fx, target.width, clientWidth, focus.ox ?? clientWidth / 2),
        top: anchoredScroll(focus.fy, target.height, clientHeight, focus.oy ?? clientHeight / 2),
        behavior: "instant",
      });
    }
    this.#refresh();
  }

  #leave(): void {
    this.#stage.classList.remove("zoomed");
    this.#image.style.removeProperty("width");
    this.#stage.scrollTo({ left: 0, top: 0, behavior: "instant" });
  }

  #refit(): void {
    if (!this.active) {
      this.#refresh();
      return;
    }
    const shown = this.#image.getBoundingClientRect();
    const box = this.#viewport();
    const focus: Focus = {
      fx: anchorFraction(box.x + this.#stage.clientWidth / 2, shown.left, shown.width),
      fy: anchorFraction(box.y + this.#stage.clientHeight / 2, shown.top, shown.height),
      ox: undefined,
      oy: undefined,
    };
    this.#leave();
    this.#enter(this.#image.getBoundingClientRect(), focus);
  }

  #refresh(): void {
    const zoomed = this.active;
    const fit = this.#image.getBoundingClientRect();
    const possible =
      zoomed || (this.#image.complete && zoomedSize(fit, this.#natural()) !== undefined);
    this.#button.disabled = !possible;
    this.#button.setAttribute("aria-pressed", String(zoomed));
    this.#button.textContent = zoomed ? "Pomniejsz" : "Powiększ";
    this.#stage.tabIndex = zoomed ? 0 : -1;
    this.#stage.classList.toggle("fixed", !possible);
  }
}
