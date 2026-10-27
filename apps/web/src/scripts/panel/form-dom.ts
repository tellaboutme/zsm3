export type Bag = Readonly<Record<string, unknown>>;

export function isBag(value: unknown): value is Bag {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function bagOf(value: unknown): Bag {
  return isBag(value) ? value : {};
}

export function textOf(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function directChildren(parent: Element, selector: string): readonly HTMLElement[] {
  return [...parent.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.matches(selector),
  );
}

export function fieldNode(parent: Element, name: string): HTMLElement | undefined {
  return directChildren(parent, `[data-field="${name}"]`)[0];
}

export function inputOf(
  wrapper: HTMLElement,
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined {
  const node = wrapper.querySelector("[data-input]");
  return node instanceof HTMLInputElement ||
    node instanceof HTMLTextAreaElement ||
    node instanceof HTMLSelectElement
    ? node
    : undefined;
}
