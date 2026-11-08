const DRAG_THRESHOLD = 4;
const ZOOM_FACTOR = 2;

interface Drag {
  readonly x: number;
  readonly y: number;
  readonly left: number;
  readonly top: number;
}

export function zoomImage(stage: HTMLElement, image: HTMLImageElement, zoomed: boolean): void {
  const fitted = image.getBoundingClientRect().width;
  stage.classList.toggle("zoomed", zoomed);
  if (!zoomed) {
    image.style.removeProperty("width");
    return;
  }
  const width = Math.round(Math.max(fitted * ZOOM_FACTOR, image.naturalWidth));
  image.style.setProperty("width", `${String(width)}px`);
  stage.scrollTo({
    left: (stage.scrollWidth - stage.clientWidth) / 2,
    top: (stage.scrollHeight - stage.clientHeight) / 2,
  });
}

export function bindDragPan(stage: HTMLElement, isZoomed: () => boolean): () => boolean {
  let drag: Drag | undefined;
  let dragged = false;
  stage.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || !isZoomed()) {
      return;
    }
    drag = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
    dragged = false;
  });
  stage.addEventListener("pointermove", (event) => {
    if (drag === undefined) {
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
      dragged = true;
      stage.classList.add("dragging");
    }
    stage.scrollTo({ left: drag.left - dx, top: drag.top - dy });
    event.preventDefault();
  });
  const stop = (): void => {
    drag = undefined;
    stage.classList.remove("dragging");
  };
  stage.addEventListener("pointerup", stop);
  stage.addEventListener("pointercancel", stop);
  stage.addEventListener("pointerleave", stop);
  return () => {
    const was = dragged;
    dragged = false;
    return was;
  };
}
