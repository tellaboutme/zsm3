import stylelint from "stylelint";
import { describe, it } from "vitest";

import { noCommentsPlugin } from "../src/stylelint/no-comments.ts";

async function lint(code: string, primary: unknown): Promise<readonly string[]> {
  const { results } = await stylelint.lint({
    code,
    config: { plugins: [noCommentsPlugin], rules: { "local/no-comments": primary } },
  });
  return results.flatMap((entry) => [
    ...entry.warnings.map((warning) => warning.rule),
    ...entry.invalidOptionWarnings.map((warning) => warning.text),
  ]);
}

describe("local/no-comments", () => {
  it("accepts css without comments", async ({ expect }) => {
    expect(await lint('a { content: "/* text */"; }', true)).toEqual([]);
  });

  it("rejects every comment", async ({ expect }) => {
    expect(await lint("/* one */ a { color: red; /* two */ }", true)).toEqual([
      "local/no-comments",
      "local/no-comments",
    ]);
  });

  it("reports invalid options", async ({ expect }) => {
    const problems = await lint("/* one */", "yes");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("local/no-comments");
  });
});
