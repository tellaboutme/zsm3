import {
  documentTypeLabels,
  statusResponseSchema,
  tokenSchema,
  type RequestStatus,
  type StatusResponse,
} from "@zsm3/contracts/requests";

const form = document.querySelector<HTMLFormElement>("[data-status-form]");
const tokenInput = form?.querySelector<HTMLInputElement>("[name=token]");
const error = document.querySelector<HTMLElement>("[data-status-error]");
const result = document.querySelector<HTMLElement>("[data-status-result]");
const withdraw = result?.querySelector<HTMLButtonElement>("[data-withdraw]");
const submit = form?.querySelector<HTMLButtonElement>("[data-status-submit]");
const labels: Readonly<Record<RequestStatus, string>> = {
  submitted: "Złożony",
  in_progress: "W trakcie",
  ready: "Gotowy do odbioru",
  collected: "Odebrany",
  rejected: "Odrzucony",
  withdrawn: "Wycofany",
};

interface View {
  readonly token: HTMLInputElement;
  readonly error: HTMLElement;
  readonly result: HTMLElement;
  readonly submit: HTMLButtonElement;
  readonly withdraw: HTMLButtonElement;
}

function fail(view: View, text: string): void {
  const state = view;
  state.result.hidden = true;
  state.error.hidden = false;
  state.error.textContent = text;
  state.error.focus();
}

async function post(path: string, token: string): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    cache: "no-store",
  });
}

function refusal(status: number): string {
  if (status === 429) return "Zbyt wiele prób. Spróbuj ponownie później.";
  if (status === 404) return "Nie znaleziono wniosku. Sprawdź kod.";
  return "Nie udało się sprawdzić stanu wniosku. Spróbuj ponownie później.";
}

function validToken(view: View): string | undefined {
  const state = view;
  const token = state.token.value.trim();
  if (tokenSchema.safeParse(token).success) {
    state.token.removeAttribute("aria-invalid");
    const fieldError = document.getElementById("token-error");
    if (fieldError !== null) fieldError.textContent = "";
    return token;
  }
  state.token.setAttribute("aria-invalid", "true");
  const fieldError = document.getElementById("token-error");
  if (fieldError !== null) fieldError.textContent = "Kod ma nieprawidłowy format.";
  fail(view, "Sprawdź kod z linku do wniosku.");
  state.token.focus();
  return undefined;
}

function render(view: View, value: StatusResponse): void {
  const state = view;
  const type = state.result.querySelector<HTMLElement>("[data-status-type]");
  const status = state.result.querySelector<HTMLElement>("[data-status-value]");
  const date = state.result.querySelector<HTMLElement>("[data-status-date]");
  const message = state.result.querySelector<HTMLElement>("[data-status-message]");
  const hint = state.result.querySelector<HTMLElement>("[data-withdraw-hint]");
  if (type === null || status === null || date === null || message === null || hint === null)
    return;
  type.textContent = documentTypeLabels[value.type];
  status.textContent = labels[value.status];
  date.textContent = new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value.updatedAt));
  message.textContent = value.collectionMessage;
  message.hidden = value.collectionMessage.length === 0;
  const open =
    value.status === "submitted" || value.status === "in_progress" || value.status === "ready";
  state.withdraw.hidden = !open;
  hint.hidden = !open;
  state.result.hidden = false;
  state.result.focus();
}

async function check(view: View): Promise<void> {
  const state = view;
  const token = validToken(view);
  const invalid = token === undefined;
  if (invalid) return;
  state.error.hidden = true;
  state.submit.disabled = true;
  try {
    const response = await post("/api/requests/status", token);
    if (!response.ok) {
      fail(view, refusal(response.status));
      return;
    }
    const body: unknown = await response.json();
    const parsed = statusResponseSchema.safeParse(body);
    if (!parsed.success) throw new Error("Invalid response");
    render(view, parsed.data);
  } catch {
    fail(view, refusal(0));
  } finally {
    state.submit.disabled = false;
  }
}

async function withdrawRequest(view: View): Promise<void> {
  const state = view;
  if (!window.confirm("Wycofać wniosek? Tej czynności nie można cofnąć.")) return;
  const token = validToken(view);
  const invalid = token === undefined;
  if (invalid) return;
  state.withdraw.disabled = true;
  try {
    const response = await post("/api/requests/withdraw", token);
    if (response.ok) await check(view);
    else
      fail(
        view,
        response.status === 409
          ? "Nie można wycofać tego wniosku."
          : "Nie udało się wycofać wniosku. Spróbuj ponownie później.",
      );
  } catch {
    fail(view, "Nie udało się wycofać wniosku. Spróbuj ponownie później.");
  } finally {
    state.withdraw.disabled = false;
  }
}

function init(view: View, form: HTMLFormElement): void {
  const state = view;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void check(view);
  });
  state.withdraw.addEventListener("click", () => {
    void withdrawRequest(view);
  });
  if (location.hash.length <= 1) return;
  let token: string;
  try {
    token = decodeURIComponent(location.hash.slice(1));
  } catch {
    fail(view, "Link ma nieprawidłowy kod. Sprawdź otrzymany link.");
    return;
  }
  if (!tokenSchema.safeParse(token).success) {
    fail(view, "Link ma nieprawidłowy kod. Sprawdź otrzymany link.");
    return;
  }
  state.token.value = token;
  void check(view);
}

if (
  form !== null &&
  tokenInput !== null &&
  tokenInput !== undefined &&
  error !== null &&
  result !== null &&
  submit !== null &&
  submit !== undefined &&
  withdraw !== null &&
  withdraw !== undefined
) {
  init({ token: tokenInput, error, result, submit, withdraw }, form);
}
