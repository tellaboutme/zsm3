import type { Rule } from "eslint";

export const noComments: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow comments: intent belongs in names and structure.",
    },
    messages: {
      comment: "Comments are not allowed. Express the intent through naming and structure.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program(): void {
        const { sourceCode } = context;
        for (const comment of sourceCode.getAllComments()) {
          context.report({ loc: sourceCode.getLoc(comment), messageId: "comment" });
        }
      },
      AstroHTMLComment(node: Rule.Node): void {
        context.report({ node, messageId: "comment" });
      },
    };
  },
};
