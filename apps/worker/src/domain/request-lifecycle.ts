import type { RequestStatus } from "@zsm3/contracts/requests";

export class InvalidTransitionError extends Error {
  readonly from: RequestStatus;
  readonly to: RequestStatus;

  constructor(from: RequestStatus, to: RequestStatus) {
    super(`Invalid request status transition from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
  }
}

const OPEN_STATUSES: readonly RequestStatus[] = ["submitted", "in_progress", "ready"];

export function isOpen(status: RequestStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

const NEXT_STATUSES: Readonly<Record<RequestStatus, readonly RequestStatus[]>> = {
  submitted: ["in_progress", "rejected", "withdrawn"],
  in_progress: ["ready", "rejected", "withdrawn"],
  ready: ["collected", "rejected", "withdrawn"],
  collected: [],
  rejected: [],
  withdrawn: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return NEXT_STATUSES[from].includes(to);
}

export function assertTransition(from: RequestStatus, to: RequestStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}
