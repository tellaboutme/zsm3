function find(root: HTMLElement, name: string): HTMLElement | undefined {
  return root.querySelector<HTMLElement>(`[data-panel="${name}"]`) ?? undefined;
}

function claim(root: HTMLElement, name: string, what: string): HTMLElement {
  const node = find(root, name);
  if (node === undefined) {
    throw new Error(`missing ${what} [data-panel="${name}"]`);
  }
  return node;
}

export interface ElOptions {
  readonly className?: string;
  readonly text?: string;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly children?: readonly HTMLElement[];
}

export function el(tag: string, options: ElOptions = {}): HTMLElement {
  const node = document.createElement(tag);
  if (options.className !== undefined) {
    node.className = options.className;
  }
  const attributes = options.attributes ?? {};
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  if (options.text !== undefined) {
    node.textContent = options.text;
  }
  for (const child of options.children ?? []) {
    node.append(child);
  }
  return node;
}

export function button(label: string, className?: string): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  if (className !== undefined) {
    node.className = className;
  }
  return node;
}

export function fieldText(form: HTMLElement, name: string): HTMLInputElement | undefined {
  return form.querySelector<HTMLInputElement>(`[name="${name}"]`) ?? undefined;
}

export function inputValue(form: HTMLElement, name: string): string {
  return fieldText(form, name)?.value ?? "";
}

export function setInputValue(form: HTMLElement, name: string, value: string): void {
  const node = fieldText(form, name);
  if (node !== undefined) {
    node.value = value;
  }
}

export function speak(target: HTMLElement, phrases: readonly string[]): void {
  target.replaceChildren(
    ...phrases.map((phrase, index) => el("span", { text: index === 0 ? phrase : ` ${phrase}` })),
  );
}

export function area(root: HTMLElement, name: string): HTMLElement {
  return claim(root, name, "area");
}

export function areaForm(root: HTMLElement, name: string): HTMLFormElement {
  const node = claim(root, name, "form");
  if (node instanceof HTMLFormElement) {
    return node;
  }
  throw new Error(`missing form [data-panel="${name}"]`);
}

export function areaList(root: HTMLElement, name: string): HTMLUListElement {
  const node = claim(root, name, "list");
  if (node instanceof HTMLUListElement) {
    return node;
  }
  throw new Error(`missing list [data-panel="${name}"]`);
}

export function areaButton(root: HTMLElement, name: string): HTMLButtonElement {
  const node = claim(root, name, "button");
  if (node instanceof HTMLButtonElement) {
    return node;
  }
  throw new Error(`missing button [data-panel="${name}"]`);
}

export function areaSelect(root: HTMLElement, name: string): HTMLSelectElement {
  const node = claim(root, name, "select");
  if (node instanceof HTMLSelectElement) {
    return node;
  }
  throw new Error(`missing select [data-panel="${name}"]`);
}

export function areaInput(root: HTMLElement, name: string): HTMLInputElement {
  const node = claim(root, name, "input");
  if (node instanceof HTMLInputElement) {
    return node;
  }
  throw new Error(`missing input [data-panel="${name}"]`);
}
