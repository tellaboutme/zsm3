import { requestTypeMeta } from "@zsm3/contracts/requests";
import { describe, it } from "vitest";

import {
  collectionMessage,
  requestTypeLabel,
  requestTypeMetadata,
} from "../../src/domain/request-types.ts";

describe("request metadata", () => {
  it("pairs each document type with its label and required applicant fields", ({ expect }) => {
    expect(requestTypeMetadata).toEqual({
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
    });
    expect(requestTypeLabel("STUDENT_ID_RENEWAL")).toBe(requestTypeMeta.STUDENT_ID_RENEWAL.label);
    expect(requestTypeLabel("STUDENT_ID_DUPLICATE")).toBe(
      requestTypeMeta.STUDENT_ID_DUPLICATE.label,
    );
    expect(requestTypeLabel("ENROLLMENT_CERTIFICATE")).toBe(
      requestTypeMeta.ENROLLMENT_CERTIFICATE.label,
    );
  });

  it("shows collection instructions only for ready and collected documents", ({ expect }) => {
    expect(collectionMessage("ready")).toContain("dokument tożsamości");
    expect(collectionMessage("collected")).toContain("odebrany");
    expect(collectionMessage("submitted")).toBe("");
    expect(collectionMessage("in_progress")).toBe("");
    expect(collectionMessage("rejected")).toBe("");
    expect(collectionMessage("withdrawn")).toBe("");
  });
});
