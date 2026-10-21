import * as astroParser from "astro-eslint-parser";
import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import { noComments } from "../src/eslint/no-comments.ts";
import { localPlugin } from "../src/eslint/plugin.ts";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester();

tester.run("no-comments", noComments, {
  valid: [
    "const answer = 42;",
    'const url = "https://example.com//path";',
    String.raw`const pattern = /a\/\/b/u;`,
    "const text = `/* not a comment */`;",
  ],
  invalid: [
    { code: "// line\nconst a = 1;", errors: [{ messageId: "comment" }] },
    { code: "const a = 1; /* block */", errors: [{ messageId: "comment" }] },
    { code: "/** doc */\nexport const a = 1;", errors: [{ messageId: "comment" }] },
    { code: '/// <reference types="node" />\nconst a = 1;', errors: [{ messageId: "comment" }] },
    {
      code: "// one\n// two\nconst a = 1;",
      errors: [{ messageId: "comment" }, { messageId: "comment" }],
    },
  ],
});

const astroTester = new RuleTester({ languageOptions: { parser: astroParser } });

astroTester.run("no-comments in astro", noComments, {
  valid: [{ code: '---\nconst title = "Home";\n---\n<h1>{title}</h1>\n', filename: "page.astro" }],
  invalid: [
    {
      code: "---\n// frontmatter\nconst title = 1;\n---\n<h1>{title}</h1>\n",
      filename: "page.astro",
      errors: [{ messageId: "comment" }],
    },
    {
      code: "<!-- template -->\n<p>Text</p>\n",
      filename: "page.astro",
      errors: [{ messageId: "comment" }],
    },
  ],
});

describe("local plugin", () => {
  it("exposes the no-comments rule", ({ expect }) => {
    expect(localPlugin.rules["no-comments"]).toBe(noComments);
  });
});
