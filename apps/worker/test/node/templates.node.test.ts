import { describe, it } from "vitest";

import { templateFor, type TemplateContext } from "../../src/mail/templates.ts";

const context: TemplateContext = {
  requestId: "11111111-2222-4333-8444-555555555555",
  type: "STUDENT_ID_RENEWAL",
  statusLink: "https://zsm3.test/e-wniosek/status#tok",
};

describe("templateFor", () => {
  it("confirms the submission and links the status page", ({ expect }) => {
    const content = templateFor("SUBMISSION_CONFIRMATION", context);
    expect(content.subject).toBe("Potwierdzenie złożenia wniosku");
    expect(content.text).toContain("Wymiana legitymacji szkolnej");
    expect(content.text).toContain(context.requestId);
    expect(content.text).toContain(context.statusLink);
    expect(content.text).toMatch(/^Dziękujemy za złożenie wniosku przez formularz e-wniosek\.\n/u);
    expect(content.text).toContain("\nStatus wniosku można sprawdzić na stronie:\n");
  });

  it("notifies the secretariat without any personal data", ({ expect }) => {
    const content = templateFor("SECRETARIAT_NOTICE", context);
    expect(content.subject).toBe("Nowy wniosek: Wymiana legitymacji szkolnej");
    expect(content.text).toContain(context.requestId);
    expect(content.text).toContain("Rodzaj wniosku: Wymiana legitymacji szkolnej");
    expect(content.text).not.toContain("Jan");
    expect(content.text).not.toContain("@");
    expect(content.text).not.toContain("status#");
    expect(content.text).toMatch(/^Złożono nowy wniosek przez formularz e-wniosek\.\n/u);
    expect(content.text.split("\n")).toHaveLength(3);
  });

  it("announces a ready document", ({ expect }) => {
    const content = templateFor("READY_NOTICE", context);
    expect(content.subject).toBe("Dokument gotowy do odbioru");
    expect(content.text).toContain("gotowy do odbioru");
    expect(content.text).toContain("dokument tożsamości");
  });

  it("informs about a rejection without repeating personal data", ({ expect }) => {
    const content = templateFor("REJECTED_NOTICE", context);
    expect(content.subject).toBe("Rozpatrzenie wniosku");
    expect(content.text).toContain(context.requestId);
    expect(content.text).toContain("odrzucony");
    expect(content.text).not.toContain("Jan");
    expect(content.text).not.toContain("@");
    expect(content.text).toContain(
      "\nStatus wniosku można sprawdzić pod linkiem otrzymanym w potwierdzeniu złożenia wniosku.",
    );
  });

  it("uses the document-specific label in applicant and secretariat mail", ({ expect }) => {
    for (const [type, label] of [
      ["STUDENT_ID_RENEWAL", "Wymiana legitymacji szkolnej"],
      ["STUDENT_ID_DUPLICATE", "Duplikat legitymacji szkolnej"],
      ["ENROLLMENT_CERTIFICATE", "Zaświadczenie o uczęszczaniu do szkoły"],
    ] as const) {
      const input = { ...context, type };
      const confirmation = templateFor("SUBMISSION_CONFIRMATION", input);
      const notice = templateFor("SECRETARIAT_NOTICE", input);
      expect(confirmation.text).toContain(`Rodzaj wniosku: ${label}`);
      expect(confirmation.text).toContain(input.statusLink);
      expect(notice.subject).toBe(`Nowy wniosek: ${label}`);
      expect(notice.text).toContain(`Rodzaj wniosku: ${label}`);
      expect(notice.text).not.toContain(input.statusLink);
    }
  });
});
