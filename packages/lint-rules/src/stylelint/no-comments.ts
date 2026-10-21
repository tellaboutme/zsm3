import stylelint from "stylelint";

const ruleName = "local/no-comments";

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: "Comments are not allowed. Express the intent through naming and structure.",
});

const rule: stylelint.Rule<boolean> = (primary) => (root, result) => {
  const valid = stylelint.utils.validateOptions(result, ruleName, {
    actual: primary,
    possible: [true],
  });
  if (!valid) {
    return;
  }
  root.walkComments((comment) => {
    stylelint.utils.report({ ruleName, result, node: comment, message: messages.rejected });
  });
};

rule.ruleName = ruleName;
rule.messages = messages;

export const noCommentsPlugin = stylelint.createPlugin(ruleName, rule);
