import "../lib/panel/zod-jitless.ts";
import { questionInputSchema, type QuestionInput } from "@zsm3/contracts/questions";

import { fieldError, lengthHint, questionRefusal } from "../lib/questions.ts";

interface Parts {
  readonly form: HTMLFormElement;
  readonly challenge: HTMLElement;
  readonly submit: HTMLButtonElement;
  readonly summary: HTMLElement;
  readonly success: HTMLElement;
  readonly again: HTMLButtonElement;
  readonly text: HTMLTextAreaElement;
  readonly count: HTMLElement;
}

const session = { formKey: crypto.randomUUID() };

function showError(parts: Parts, message: string, field?: string): void {
  const summary = parts.summary;
  summary.hidden = false;
  summary.textContent = message;
  const input = field === undefined ? null : parts.form.querySelector(`[name="${field}"]`);
  if (input instanceof HTMLElement) {
    input.setAttribute("aria-invalid", "true");
    const error = document.getElementById(`${field ?? ""}-error`);
    if (error !== null) error.textContent = message;
    input.focus();
    return;
  }
  summary.focus();
}

function clearErrors(parts: Parts): void {
  const summary = parts.summary;
  summary.hidden = true;
  summary.textContent = "";
  for (const input of parts.form.querySelectorAll("[aria-invalid]"))
    input.removeAttribute("aria-invalid");
  for (const error of parts.form.querySelectorAll(".field-error")) error.textContent = "";
}

function collect(parts: Parts): unknown {
  const values = new FormData(parts.form);
  return {
    addressee: values.get("addressee"),
    question: values.get("question"),
    rulesAccepted: values.has("rulesAccepted"),
    honeypot: values.get("honeypot"),
    formKey: session.formKey,
    turnstileToken: window.turnstile?.getResponse(parts.challenge) ?? "",
  };
}

function validate(parts: Parts): QuestionInput | undefined {
  const parsed = questionInputSchema.safeParse(collect(parts));
  if (parsed.success) return parsed.data;
  const field = parsed.error.issues[0]?.path[0];
  const name = typeof field === "string" ? field : undefined;
  showError(parts, fieldError(name), name);
  return undefined;
}

function updateCount(parts: Parts): void {
  const count = parts.count;
  count.textContent = lengthHint(parts.text.value.length);
}

function received(parts: Parts): void {
  const { form, success } = parts;
  form.reset();
  updateCount(parts);
  session.formKey = crypto.randomUUID();
  form.hidden = true;
  success.hidden = false;
  success.focus();
}

async function send(parts: Parts, value: QuestionInput): Promise<void> {
  const submit = parts.submit;
  submit.disabled = true;
  try {
    const response = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (response.status === 202) {
      received(parts);
      return;
    }
    showError(parts, questionRefusal(response.status));
  } catch {
    showError(parts, questionRefusal(0));
  } finally {
    submit.disabled = false;
    window.turnstile?.reset(parts.challenge);
  }
}

function wire(parts: Parts): void {
  parts.text.addEventListener("input", () => {
    updateCount(parts);
  });
  parts.form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearErrors(parts);
    const value = validate(parts);
    if (value !== undefined) void send(parts, value);
  });
  parts.again.addEventListener("click", () => {
    const { form, success } = parts;
    success.hidden = true;
    form.hidden = false;
    parts.text.focus();
  });
}

function claim<T extends Element>(
  root: ParentNode,
  selector: string,
  kind: { new (): T; prototype: T },
): T {
  const node = root.querySelector(selector);
  if (!(node instanceof kind)) throw new Error(`missing ${selector}`);
  return node;
}

function find(): Parts {
  const form = claim(document, "[data-question-form]", HTMLFormElement);
  const success = claim(document, "[data-question-success]", HTMLElement);
  return {
    form,
    success,
    challenge: claim(form, ".cf-turnstile", HTMLElement),
    submit: claim(form, "[data-submit]", HTMLButtonElement),
    summary: claim(form, "#question-errors", HTMLElement),
    again: claim(success, "[data-question-again]", HTMLButtonElement),
    text: claim(form, "#question-text", HTMLTextAreaElement),
    count: claim(form, "[data-question-count]", HTMLElement),
  };
}

wire(find());
