import type { RequestStatus } from "./requests.ts";

export const requestStatusLabels: Readonly<Record<RequestStatus, string>> = {
  submitted: "Złożony",
  in_progress: "W trakcie",
  ready: "Gotowy do odbioru",
  collected: "Odebrany",
  rejected: "Odrzucony",
  withdrawn: "Wycofany",
};
