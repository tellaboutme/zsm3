import {
  FEATURED_SLOT_LABELS,
  FEATURED_SLOTS,
  featuredSlotSchema,
  panelFeaturedListSchema,
  type PanelFeaturedPhoto,
} from "@zsm3/contracts/featured";

import { button, el, speak } from "./dom.ts";
import { panelRead, panelSend } from "../../lib/panel/api.ts";
import {
  featuredClearedPhrase,
  featuredCountPhrase,
  featuredPath,
  featuredRowText,
  featuredSetPhrase,
} from "../../lib/panel/featured.ts";
import { galleryProblemPhrase } from "../../lib/panel/gallery.ts";
import { parse } from "../../lib/panel/models.ts";

interface FeatureInput {
  readonly photoId: string;
  readonly number: string;
  readonly published: boolean;
  readonly say: (phrase: string) => void;
}

export function featureControl({ photoId, number, published, say }: FeatureInput): HTMLElement {
  const select = document.createElement("select");
  select.append(el("option", { text: "Wybierz miejsce", attributes: { value: "" } }));
  for (const slot of FEATURED_SLOTS) {
    select.append(el("option", { text: FEATURED_SLOT_LABELS[slot], attributes: { value: slot } }));
  }
  const field = document.createElement("label");
  field.append(`Wyróżnij zdjęcie ${number} jako`, select);
  const apply = button(`Wyróżnij zdjęcie ${number}`);
  apply.addEventListener("click", () => {
    const slot = featuredSlotSchema.safeParse(select.value);
    if (!slot.success) {
      say("Wybierz miejsce, w którym ma się pojawić zdjęcie.");
      return;
    }
    apply.disabled = true;
    void panelSend("PUT", featuredPath(slot.data), { photoId }).then((response) => {
      apply.disabled = false;
      say(
        response.ok
          ? featuredSetPhrase(slot.data, published)
          : galleryProblemPhrase(response.status, response.data),
      );
    });
  });
  return el("div", { className: "panel-actions", children: [field, apply] });
}

function featuredRow(
  item: PanelFeaturedPhoto,
  status: HTMLElement,
  reload: () => Promise<void>,
): HTMLElement {
  const remove = button(`Usuń wyróżnienie: ${FEATURED_SLOT_LABELS[item.slot]}`);
  remove.addEventListener("click", () => {
    remove.disabled = true;
    void panelSend("DELETE", featuredPath(item.slot), {}).then(async (response) => {
      remove.disabled = false;
      if (!response.ok) {
        speak(status, [galleryProblemPhrase(response.status, response.data)]);
        return;
      }
      await reload();
      speak(status, [featuredClearedPhrase(item.slot)]);
    });
  });
  return el("li", {
    className: "panel-item",
    attributes: { "data-featured-slot": item.slot },
    children: [el("p", { text: featuredRowText(item) }), remove],
  });
}

export async function loadFeatured(rows: HTMLUListElement, status: HTMLElement): Promise<void> {
  const response = await panelRead("/api/panel/featured");
  const list = parse(panelFeaturedListSchema, response.data);
  if (list === undefined) {
    speak(status, [galleryProblemPhrase(response.status, response.data)]);
    return;
  }
  const reload = async (): Promise<void> => loadFeatured(rows, status);
  rows.replaceChildren(...list.items.map((item) => featuredRow(item, status, reload)));
  speak(status, [featuredCountPhrase(list.items.length)]);
}
