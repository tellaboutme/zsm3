export interface UnhandledErrorEvent {
  readonly event: "unhandled_error";
  readonly requestId: string;
  readonly errorName: string;
}

export type LogEvent = UnhandledErrorEvent;

export function logEvent(entry: LogEvent): void {
  console.error(JSON.stringify(entry));
}
