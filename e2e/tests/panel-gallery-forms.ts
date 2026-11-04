import type { Page } from "@playwright/test";

const SENT_FORMS = "zsm3SentForms";

export async function recordSentForms(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    const forms: FormData[] = [];
    Reflect.set(globalThis, key, forms);
    class RecordedFormData extends FormData {
      constructor() {
        super();
        forms.push(this);
      }
    }
    Reflect.set(globalThis, "FormData", RecordedFormData);
  }, SENT_FORMS);
}

export async function sentFile(page: Page, field: "small" | "large"): Promise<Uint8Array> {
  const bytes = await page.evaluate(
    async ([key, name]) => {
      const forms: unknown = Reflect.get(globalThis, key);
      const form: unknown = Array.isArray(forms) ? forms.at(-1) : undefined;
      const file: unknown = form instanceof FormData ? form.get(name) : undefined;
      if (!(file instanceof File)) {
        throw new Error("no file sent");
      }
      return [...new Uint8Array(await file.arrayBuffer())];
    },
    [SENT_FORMS, field] as const,
  );
  return Uint8Array.from(bytes);
}
