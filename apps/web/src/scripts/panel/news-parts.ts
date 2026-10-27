import type { BlocksUi } from "./blocks-ui.ts";
import { area, areaButton, areaForm } from "./dom.ts";

export interface NewsRef {
  year: string;
  slug: string;
  touched: boolean;
}

export interface NewsParts {
  readonly form: HTMLFormElement;
  readonly status: HTMLElement;
  readonly publish: HTMLButtonElement;
  readonly unpublish: HTMLButtonElement;
  readonly blocks: BlocksUi;
  readonly ref: NewsRef;
  readonly onSaved: () => void;
}

export function newsPartsFor(
  section: HTMLElement,
  blocks: BlocksUi,
  onSaved: () => void,
): NewsParts {
  return {
    form: areaForm(section, "form"),
    status: area(section, "form-status"),
    publish: areaButton(section, "news-publish"),
    unpublish: areaButton(section, "news-unpublish"),
    blocks,
    ref: { year: "", slug: "", touched: false },
    onSaved,
  };
}
