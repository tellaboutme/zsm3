export interface UnhandledErrorEvent {
  readonly event: "unhandled_error";
  readonly requestId: string;
  readonly errorName: string;
}

export interface TurnstileUnavailableEvent {
  readonly event: "turnstile_unavailable";
  readonly errorName: string;
}

export interface OutboxEnqueueFailedEvent {
  readonly event: "outbox_enqueue_failed";
  readonly requestId: string;
  readonly errorName: string;
}

export type LogEvent = UnhandledErrorEvent | TurnstileUnavailableEvent | OutboxEnqueueFailedEvent;

export function logEvent(entry: LogEvent): void {
  console.error(JSON.stringify(entry));
}
