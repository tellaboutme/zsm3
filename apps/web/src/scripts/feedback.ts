const RESET_MS = 2200;

const timers = new WeakMap<HTMLElement, number>();
const originals = new WeakMap<HTMLElement, string>();

export type FeedbackState = "done" | "failed";

export function flash(target: HTMLElement, state: FeedbackState, label?: string): void {
  const text = target.querySelector<HTMLElement>("[data-feedback-label]");
  if (text !== null && label !== undefined) {
    if (!originals.has(text)) {
      originals.set(text, text.textContent);
    }
    text.textContent = label;
  }
  target.setAttribute("data-feedback", state);
  window.clearTimeout(timers.get(target));
  timers.set(
    target,
    window.setTimeout(() => {
      target.removeAttribute("data-feedback");
      const original = text === null ? undefined : originals.get(text);
      if (text !== null && original !== undefined) {
        text.textContent = original;
      }
    }, RESET_MS),
  );
}
