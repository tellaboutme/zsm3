const DRAG_THRESHOLD = 4;
const STOP_EVENTS = ["pointerup", "pointercancel", "lostpointercapture", "pointerleave"] as const;

interface Drag {
  readonly pointer: number;
  readonly x: number;
  readonly y: number;
  readonly left: number;
  readonly top: number;
}

class DragPan {
  readonly #stage: HTMLElement;
  readonly #isZoomed: () => boolean;
  #drag: Drag | undefined;
  #dragged = false;

  constructor(stage: HTMLElement, isZoomed: () => boolean) {
    this.#stage = stage;
    this.#isZoomed = isZoomed;
  }

  get dragged(): boolean {
    return this.#dragged;
  }

  bind(): void {
    this.#stage.addEventListener("pointerdown", (event) => {
      this.#start(event);
    });
    this.#stage.addEventListener("pointermove", (event) => {
      this.#move(event);
    });
    for (const name of STOP_EVENTS) {
      this.#stage.addEventListener(name, () => {
        this.#stop();
      });
    }
  }

  #start(event: PointerEvent): void {
    this.#dragged = false;
    if (event.pointerType !== "mouse" || event.button !== 0 || !this.#isZoomed()) {
      return;
    }
    const { scrollLeft, scrollTop } = this.#stage;
    this.#drag = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: scrollLeft,
      top: scrollTop,
    };
  }

  #move(event: PointerEvent): void {
    const drag = this.#drag;
    if (drag?.pointer !== event.pointerId) {
      return;
    }
    if ((event.buttons & 1) === 0) {
      this.#stop();
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!this.#dragged && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
      this.#dragged = true;
      this.#stage.classList.add("dragging");
      this.#stage.setPointerCapture(event.pointerId);
    }
    if (this.#dragged) {
      this.#stage.scrollTo({ left: drag.left - dx, top: drag.top - dy, behavior: "instant" });
      event.preventDefault();
    }
  }

  #stop(): void {
    this.#drag = undefined;
    this.#stage.classList.remove("dragging");
    setTimeout(() => {
      this.#dragged = false;
    }, 0);
  }
}

export function bindDragPan(stage: HTMLElement, isZoomed: () => boolean): () => boolean {
  const pan = new DragPan(stage, isZoomed);
  pan.bind();
  return () => pan.dragged;
}
