export interface EmailMessage {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export class EmailDeliveryError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string, cause?: unknown) {
    super(`Email delivery failed: ${errorCode}`, { cause });
    this.name = "EmailDeliveryError";
    this.errorCode = errorCode;
  }
}
