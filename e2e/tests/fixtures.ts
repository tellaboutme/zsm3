import { test as base } from "@playwright/test";

interface PageProblems {
  readonly problems: string[];
}

const MISSING_DOCUMENT = "Failed to load resource: the server responded with a status of 404";

export const test = base.extend<PageProblems>({
  problems: async ({ page }, use) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      const isProblem = message.type() === "error" || message.type() === "warning";
      const isMissingDocument =
        message.text().startsWith(MISSING_DOCUMENT) && message.location().url === page.url();
      if (isProblem && !isMissingDocument) {
        problems.push(`console ${message.type()}: ${message.text()}`);
      }
    });
    await use(problems);
  },
});

export { expect } from "@playwright/test";
