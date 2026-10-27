import {
  requestInputSchema,
  submissionResponseSchema,
  type RequestInput,
} from "@zsm3/contracts/requests";

import { requestFieldLabels, requestRefusal } from "./request-field-labels.ts";

declare global {
  interface Window {
    turnstile?: {
      getResponse(container: HTMLElement): string;
      reset(container: HTMLElement): void;
    };
  }
}
const form = document.querySelector<HTMLFormElement>("[data-request-form]");
const challenge = form?.querySelector<HTMLElement>(".cf-turnstile");
const submit = form?.querySelector<HTMLButtonElement>("[data-submit]");
const summary = form?.querySelector<HTMLElement>("#request-errors");
const success = document.querySelector<HTMLElement>("[data-request-success]");
const link = success?.querySelector<HTMLAnchorElement>("[data-status-link]");
const started = Date.now();
const formKey = crypto.randomUUID();
function updateFields(form: HTMLFormElement): void {
  const type = form.querySelector<HTMLSelectElement>("[name=type]");
  const classField = form.querySelector<HTMLElement>("[data-class-field]");
  const yearField = form.querySelector<HTMLElement>("[data-year-field]");
  const classInput = form.querySelector<HTMLSelectElement>("[name=className]");
  const yearInput = form.querySelector<HTMLInputElement>("[name=graduationYear]");
  if (
    type === null ||
    classField === null ||
    yearField === null ||
    classInput === null ||
    yearInput === null
  )
    return;
  const certificate = type.value === "ENROLLMENT_CERTIFICATE";
  classField.hidden = type.value.length === 0;
  yearField.hidden = !certificate;
  classInput.required = !certificate && !classField.hidden;
  if (!certificate) yearInput.value = "";
}
function showError(
  form: HTMLFormElement,
  summary: HTMLElement,
  message: string,
  field?: string,
): void {
  const target = summary;
  target.hidden = false;
  target.textContent = message;
  const input = field === undefined ? null : form.elements.namedItem(field);
  if (input instanceof HTMLElement) {
    input.setAttribute("aria-invalid", "true");
    const error = document.getElementById(`${field ?? ""}-error`);
    if (error !== null) error.textContent = message;
    input.focus();
    return;
  }
  summary.focus();
}
function clearErrors(form: HTMLFormElement, summary: HTMLElement): void {
  const target = summary;
  target.hidden = true;
  target.textContent = "";
  for (const input of form.querySelectorAll("[aria-invalid]"))
    input.removeAttribute("aria-invalid");
  for (const error of form.querySelectorAll(".field-error")) error.textContent = "";
}
function input(form: HTMLFormElement, challenge: HTMLElement): unknown {
  const values = new FormData(form);
  const schoolClass = values.get("className");
  const graduationYear = values.get("graduationYear");
  return {
    type: values.get("type"),
    firstName: values.get("firstName"),
    lastName: values.get("lastName"),
    email: values.get("email"),
    note: values.get("note"),
    ...(typeof schoolClass === "string" && schoolClass.length > 0
      ? { className: schoolClass }
      : {}),
    ...(typeof graduationYear === "string" && graduationYear.length > 0
      ? { graduationYear: Number(graduationYear) }
      : {}),
    noticesAccepted: values.has("noticesAccepted"),
    honeypot: values.get("honeypot"),
    formKey,
    submittedAtMs: started,
    turnstileToken: window.turnstile?.getResponse(challenge) ?? "",
  };
}
function validate(
  value: unknown,
  form: HTMLFormElement,
  summary: HTMLElement,
): RequestInput | undefined {
  const parsed = requestInputSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const field = parsed.error.issues[0]?.path[0];
  const name = typeof field === "string" ? field : undefined;
  showError(
    form,
    summary,
    name === undefined
      ? "Sprawdź dane we wniosku."
      : (requestFieldLabels[name] ?? "Sprawdź dane w tym polu."),
    name,
  );
  return undefined;
}
function accepted(
  body: unknown,
  form: HTMLFormElement,
  success: HTMLElement,
  link: HTMLAnchorElement,
): void {
  const statusLink = link;
  const activeForm = form;
  const panel = success;
  const parsed = submissionResponseSchema.safeParse(body);
  if (!parsed.success) throw new Error("Invalid response");
  const target = new URL(parsed.data.statusUrl, location.origin);
  if (
    target.origin !== location.origin ||
    target.pathname !== "/e-wniosek/status" ||
    target.search !== ""
  )
    throw new Error("Invalid status link");
  statusLink.href = target.pathname + target.hash;
  form.reset();
  activeForm.hidden = true;
  panel.hidden = false;
  panel.focus();
}
async function send(
  value: RequestInput,
  form: HTMLFormElement,
  submit: HTMLButtonElement,
  context: {
    readonly summary: HTMLElement;
    readonly challenge: HTMLElement;
    readonly success: HTMLElement;
    readonly link: HTMLAnchorElement;
  },
): Promise<void> {
  const action = submit;
  action.disabled = true;
  try {
    const response = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
      cache: "no-store",
    });
    if (!response.ok) {
      showError(form, context.summary, requestRefusal(response.status));
      return;
    }
    const body: unknown = await response.json();
    accepted(body, form, context.success, context.link);
  } catch {
    showError(form, context.summary, requestRefusal(0));
  } finally {
    action.disabled = false;
    window.turnstile?.reset(context.challenge);
  }
}
if (
  form !== null &&
  challenge !== null &&
  challenge !== undefined &&
  submit !== null &&
  submit !== undefined &&
  summary !== null &&
  summary !== undefined &&
  success !== null &&
  link !== null &&
  link !== undefined
) {
  const activeForm = form;
  const activeChallenge = challenge;
  const activeSummary = summary;
  const active = { submit, success, link };
  form.querySelector("[name=type]")?.addEventListener("change", () => {
    updateFields(activeForm);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearErrors(activeForm, activeSummary);
    const value = validate(input(activeForm, activeChallenge), activeForm, activeSummary);
    if (value !== undefined)
      void send(value, activeForm, active.submit, {
        summary: activeSummary,
        challenge: activeChallenge,
        success: active.success,
        link: active.link,
      });
  });
}
