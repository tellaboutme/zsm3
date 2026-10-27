import "../../lib/panel/zod-jitless.ts";
import { datasetSchemas } from "@zsm3/contracts/datasets";
import type { StoredFile } from "@zsm3/contracts/media";

import { area, areaForm, areaSelect, speak } from "./dom.ts";
import { readField } from "./form-read.ts";
import { renderField } from "./form-render.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireRevisions, type RevisionsUi } from "./revisions-ui.ts";
import { wireShell } from "./shell.ts";
import { panelRead, panelSend, problemPhrase } from "../../lib/panel/api.ts";
import { datasetForm, type DatasetForm } from "../../lib/panel/dataset-forms.ts";
import { issuePhrase } from "../../lib/panel/forms.ts";
import { canEditContent } from "../../lib/panel/gate.ts";
import { PANEL_SCHEMAS, parse } from "../../lib/panel/models.ts";
import { datasetSave } from "../../lib/panel/mutations.ts";

interface Parts {
  readonly choice: HTMLSelectElement;
  readonly intro: HTMLElement;
  readonly page: HTMLElement;
  readonly form: HTMLFormElement;
  readonly fields: HTMLElement;
  readonly status: HTMLElement;
  readonly history: RevisionsUi;
}

function chosen(parts: Parts): DatasetForm | undefined {
  return datasetForm(parts.choice.value);
}

async function uploadedFiles(): Promise<readonly StoredFile[]> {
  const list = parse(PANEL_SCHEMAS.fileList, (await panelRead("/api/panel/files")).data);
  return list?.items ?? [];
}

async function load(parts: Parts): Promise<void> {
  const form = chosen(parts);
  if (form === undefined) {
    return;
  }
  const { intro, page, fields } = parts;
  intro.textContent = form.intro;
  page.setAttribute("href", form.page);
  speak(parts.status, ["Wczytywanie…"]);
  const [response, files] = await Promise.all([
    panelRead(`/api/panel/datasets/${form.key}`),
    uploadedFiles(),
  ]);
  const view = parse(PANEL_SCHEMAS.dataset, response.data);
  if (view === undefined) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  fields.replaceChildren(renderField(form.root, view.data, { files }));
  parts.history.open(form.key);
  speak(parts.status, [`Wczytano: ${form.title}.`]);
}

async function save(parts: Parts): Promise<void> {
  const form = chosen(parts);
  const root = parts.fields.firstElementChild;
  if (form === undefined || !(root instanceof HTMLElement)) {
    return;
  }
  const parsed = datasetSchemas[form.key].safeParse(readField(form.root, root));
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    speak(parts.status, [issue === undefined ? problemPhrase(422) : issuePhrase(form.root, issue)]);
    return;
  }
  const response = await panelSend(
    "PUT",
    `/api/panel/datasets/${form.key}`,
    datasetSave(form.key, parsed.data),
  );
  if (!response.ok) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  parts.history.open(form.key);
  speak(parts.status, [`Zapisano: ${form.title}. Zmiana jest już na stronie.`]);
}

export function wireZestawy(section: HTMLElement): void {
  const parts: Parts = {
    choice: areaSelect(section, "dataset"),
    intro: area(section, "dataset-intro"),
    page: area(section, "dataset-page"),
    form: areaForm(section, "dataset-form"),
    fields: area(section, "dataset-fields"),
    status: area(section, "status"),
    history: wireRevisions(section, "datasets", () => {
      void load(parts);
    }),
  };
  const fromHash = datasetForm(window.location.hash.slice(1));
  if (fromHash !== undefined) {
    parts.choice.value = fromHash.key;
  }
  parts.choice.addEventListener("change", () => {
    window.history.replaceState(null, "", `#${parts.choice.value}`);
    void load(parts);
  });
  parts.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void save(parts);
  });
  const view = gateView(section);
  wireShell(view, (role) => {
    if (!canEditContent(role)) {
      denyContent(view);
      return;
    }
    void load(parts);
  });
}

const section = document.querySelector<HTMLElement>('[data-panel-page="datasets"]');

if (section !== null) {
  wireZestawy(section);
}
