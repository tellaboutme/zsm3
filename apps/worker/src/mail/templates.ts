import type { EmailKind, RequestType } from "@zsm3/contracts/requests";

import { collectionMessage, requestTypeLabel } from "../domain/request-types.ts";

export interface TemplateContext {
  readonly requestId: string;
  readonly type: RequestType;
  readonly statusLink: string;
}

export interface EmailContent {
  readonly subject: string;
  readonly text: string;
}

export function templateFor(kind: EmailKind, context: TemplateContext): EmailContent {
  switch (kind) {
    case "SUBMISSION_CONFIRMATION":
      return {
        subject: "Potwierdzenie złożenia wniosku",
        text: [
          "Dziękujemy za złożenie wniosku przez formularz e-wniosek.",
          `Rodzaj wniosku: ${requestTypeLabel(context.type)}`,
          `Numer wniosku: ${context.requestId}`,
          "Status wniosku można sprawdzić na stronie:",
          context.statusLink,
        ].join("\n"),
      };
    case "SECRETARIAT_NOTICE":
      return {
        subject: `Nowy wniosek: ${requestTypeLabel(context.type)}`,
        text: [
          "Złożono nowy wniosek przez formularz e-wniosek.",
          `Numer wniosku: ${context.requestId}`,
          `Rodzaj wniosku: ${requestTypeLabel(context.type)}`,
        ].join("\n"),
      };
    case "READY_NOTICE":
      return {
        subject: "Dokument gotowy do odbioru",
        text: collectionMessage("ready"),
      };
    case "REJECTED_NOTICE":
      return {
        subject: "Rozpatrzenie wniosku",
        text: [
          `Wniosek nr ${context.requestId} (${requestTypeLabel(context.type)}) został odrzucony.`,
          "Status wniosku można sprawdzić pod linkiem otrzymanym w potwierdzeniu złożenia wniosku.",
        ].join("\n"),
      };
  }
}
