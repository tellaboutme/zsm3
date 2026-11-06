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

export interface AccessConfigEvent {
  readonly event: "access_config_missing";
  readonly requestId: string;
}

export interface IndexNowUnavailableEvent {
  readonly event: "indexnow_unavailable";
  readonly errorName: string;
  readonly status?: number;
}

export interface PanelWriteRecoveredEvent {
  readonly event: "panel_write_recovered";
  readonly errorName: string;
}

export type HousekeepingTask = "rate_limits" | "short_links" | "questions";

export interface HousekeepingFailedEvent {
  readonly event: "housekeeping_failed";
  readonly task: HousekeepingTask;
  readonly errorName: string;
}

export interface QuestionUnreadableEvent {
  readonly event: "question_unreadable";
  readonly part: "question" | "draft";
  readonly keyId: string;
}

export type LogEvent =
  | UnhandledErrorEvent
  | TurnstileUnavailableEvent
  | OutboxEnqueueFailedEvent
  | AccessConfigEvent
  | IndexNowUnavailableEvent
  | PanelWriteRecoveredEvent
  | HousekeepingFailedEvent
  | QuestionUnreadableEvent;

export function logEvent(entry: LogEvent): void {
  console.error(JSON.stringify(entry));
}
