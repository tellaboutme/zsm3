import { requestTypeMeta, type RequestStatus, type RequestType } from "@zsm3/contracts/requests";

export interface RequestTypeInfo {
  readonly label: string;
  readonly requiredFields: readonly string[];
}

export const requestTypeMetadata: Readonly<Record<RequestType, RequestTypeInfo>> = {
  STUDENT_ID_RENEWAL: {
    label: requestTypeMeta.STUDENT_ID_RENEWAL.label,
    requiredFields: ["className"],
  },
  STUDENT_ID_DUPLICATE: {
    label: requestTypeMeta.STUDENT_ID_DUPLICATE.label,
    requiredFields: ["className"],
  },
  ENROLLMENT_CERTIFICATE: {
    label: requestTypeMeta.ENROLLMENT_CERTIFICATE.label,
    requiredFields: ["className", "graduationYear"],
  },
};

export function requestTypeLabel(type: RequestType): string {
  return requestTypeMetadata[type].label;
}

const collectionMessages: Readonly<Partial<Record<RequestStatus, string>>> = {
  ready:
    "Dokument jest gotowy do odbioru w sekretariacie szkoły. Prosimy przyjść osobiście i zabrać ze sobą dokument tożsamości.",
  collected: "Dokument został odebrany w sekretariacie szkoły.",
};

export function collectionMessage(status: RequestStatus): string {
  return collectionMessages[status] ?? "";
}
