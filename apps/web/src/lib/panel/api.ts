import { PROBLEM_CONTENT_TYPE } from "@zsm3/contracts/problem";

export interface PanelResult {
  readonly status: number;
  readonly ok: boolean;
  readonly data: unknown;
}

const PROBLEM_STATUSES: Readonly<Record<string, string>> = {
  401: "Sesja panelu wygasła. Zaloguj się przez Cloudflare Access i spróbuj ponownie.",
  403: "Brak uprawnień do tej czynności.",
  404: "Nie znaleziono elementu. Odśwież listę.",
  405: "Żądanie ma niedozwoloną metodę.",
  413: "Plik jest za duży (limit 100 MB).",
  422: "Serwer nie przyjął danych. Sprawdź pola i spróbuj ponownie.",
  500: "Błąd serwera. Odczekaj chwilę i spróbuj ponownie.",
};

export const CONNECTION_STATUS = 0;

export const CONNECTION_PHRASE = "Brak połączenia z serwerem. Spróbuj ponownie.";

export function problemPhrase(status: number): string {
  const phrase = PROBLEM_STATUSES[status];
  if (phrase === undefined) {
    return "Nieoczekiwana odpowiedź serwera. Spróbuj ponownie.";
  }
  return phrase;
}

export const DEV_TOKEN_KEY = "panel-dev-token";

function devAssertionHeaders(): Record<string, string> {
  try {
    const token = sessionStorage.getItem(DEV_TOKEN_KEY);
    if (token !== null && token.trim().length > 0) {
      return { "Cf-Access-Jwt-Assertion": token.trim() };
    }
    return {};
  } catch {
    return {};
  }
}

function typedResponse(response: Response): boolean {
  const type = response.headers.get("Content-Type") ?? "";
  return (
    type === PROBLEM_CONTENT_TYPE ||
    type === "application/json" ||
    type.startsWith("application/json;")
  );
}

async function readData(response: Response): Promise<unknown> {
  if (response.status === 204 || !typedResponse(response)) {
    return undefined;
  }
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function methodInit(method: Exclude<HttpMethod, "GET">, body: unknown): RequestInit {
  return {
    method,
    headers: { ...devAssertionHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request(method: HttpMethod, path: string, body: unknown): Promise<PanelResult> {
  const init: RequestInit =
    method === "GET" ? { method, headers: devAssertionHeaders() } : methodInit(method, body);
  try {
    const response = await fetch(path, init);
    return { status: response.status, ok: response.ok, data: await readData(response) };
  } catch {
    return { status: CONNECTION_STATUS, ok: false, data: undefined };
  }
}

export async function panelRead(path: string): Promise<PanelResult> {
  return request("GET", path, undefined);
}

export async function panelSend(
  method: Exclude<HttpMethod, "GET">,
  path: string,
  body: unknown,
): Promise<PanelResult> {
  return request(method, path, body);
}

export async function panelDelete(path: string): Promise<PanelResult> {
  return request("DELETE", path, undefined);
}
