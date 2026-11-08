const DRAG_THRESHOLD = 4;

interface Drag {
  readonly pointer: number;
  readonly x: number;
  readonly y: number;
  readonly left: number;
  readonly top: number;
}

function startDrag(event: PointerEvent, stage: HTMLElement): Drag {
  return {
    pointer: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    left: stage.scrollLeft,
    top: stage.scrollTop,
  };
}

export function bindDragPan(stage: HTMLElement, isZoomed: () => boolean): () => boolean {
  let drag: Drag | undefined;
  let dragged = false;
  stage.addEventListener("pointerdown", (event) => {
    dragged = false;
    if (event.pointerType !== "mouse" || event.button !== 0 || !isZoomed()) {
      return;
    }
    drag = startDrag(event, stage);
  });
  stage.addEventListener("pointermove", (event) => {
    if (drag?.pointer !== event.pointerId) {
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!dragged && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
      dragged = true;
      stage.classList.add("dragging");
      stage.setPointerCapture(event.pointerId);
    }
    if (dragged) {
      stage.scrollTo({ left: drag.left - dx, top: drag.top - dy, behavior: "instant" });
      event.preventDefault();
    }
  });
  const stop = (): void => {
    drag = undefined;
    stage.classList.remove("dragging");
  };
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    stage.addEventListener(name, stop);
  }
  return () => dragged;
}
