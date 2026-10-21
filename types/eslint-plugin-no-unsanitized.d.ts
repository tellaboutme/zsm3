declare module "eslint-plugin-no-unsanitized" {
  import type { ESLint, Linter } from "eslint";

  const plugin: ESLint.Plugin & { configs: { recommended: Linter.Config } };
  export default plugin;
}
