import type { HousekeepingStep } from "../jobs/housekeeping.ts";

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

export interface ShortLinkFileCleanupEvent {
  readonly event: "short_link_file_cleanup_deferred";
  readonly errorName: string;
}

export interface HousekeepingFailedEvent {
  readonly event: "housekeeping_step_failed";
  readonly step: HousekeepingStep;
  readonly errorName: string;
}

export interface PanelWriteRecoveredEvent {
  readonly event: "panel_write_recovered";
  readonly errorName: string;
}

export type LogEvent =
  | UnhandledErrorEvent
  | TurnstileUnavailableEvent
  | OutboxEnqueueFailedEvent
  | AccessConfigEvent
  | IndexNowUnavailableEvent
  | ShortLinkFileCleanupEvent
  | HousekeepingFailedEvent
  | PanelWriteRecoveredEvent;

export function logEvent(entry: LogEvent): void {
  console.error(JSON.stringify(entry));
}
