import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import astro from "eslint-plugin-astro";
import { createNodeResolver, importX } from "eslint-plugin-import-x";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import regexp from "eslint-plugin-regexp";
import globals from "globals";
import tseslint from "typescript-eslint";

import { localPlugin } from "@zsm3/lint-rules/eslint";

const sqlInterpolation =
  "CallExpression[callee.property.name='prepare'] > :matches(TemplateLiteral[expressions.length>0], BinaryExpression)";

export default defineConfig(
  globalIgnores([
    "tools/",
    "**/dist/",
    "**/coverage/",
    "**/reports/",
    "**/.astro/",
    "**/.wrangler/",
    "**/.stryker-tmp/",
    "**/worker-configuration.d.ts",
    "playwright-report/",
    "test-results/",
    ".lighthouseci/",
  ]),
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  regexp.configs["flat/recommended"],
  noUnsanitized.configs.recommended,
  astro.configs["flat/recommended"],
  astro.configs["flat/jsx-a11y-strict"],
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.es2024 },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".astro"],
      },
    },
    settings: {
      "import-x/resolver-next": [
        createTypeScriptImportResolver({ alwaysTryTypes: true, noWarnOnMultipleProjects: true }),
        createNodeResolver(),
      ],
    },
    plugins: { local: localPlugin },
    rules: {
      "local/no-comments": "error",
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "no-console": "error",
      "no-param-reassign": ["error", { props: true }],
      "no-nested-ternary": "error",
      "no-implicit-coercion": "error",
      "no-restricted-syntax": [
        "error",
        { selector: sqlInterpolation, message: "Bind SQL parameters with .bind() instead." },
        { selector: "TSEnumDeclaration", message: "Use a union of string literals." },
        { selector: "ForInStatement", message: "Iterate with for...of over Object.entries." },
      ],
      "object-shorthand": ["error", "always"],
      "prefer-const": "error",
      "prefer-template": "error",
      complexity: ["error", 10],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "max-lines": ["error", { max: 200, skipBlankLines: true }],
      "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, IIFEs: true }],
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/promise-function-async": "error",
      "@typescript-eslint/require-array-sort-compare": "error",
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        { allowString: false, allowNumber: false, allowNullableObject: false },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { requireDefaultForNonUnion: true, considerDefaultExhaustiveForUnions: false },
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "variable", format: ["camelCase", "UPPER_CASE", "PascalCase"] },
        { selector: "function", format: ["camelCase", "PascalCase"] },
        { selector: "parameter", format: ["camelCase"], leadingUnderscore: "forbid" },
      ],
      "import-x/no-cycle": "error",
      "import-x/no-named-as-default-member": "off",
      "import-x/no-unresolved": ["error", { ignore: ["^cloudflare:"] }],
      "import-x/no-duplicates": "error",
      "import-x/no-extraneous-dependencies": "error",
      "import-x/no-mutable-exports": "error",
      "import-x/no-self-import": "error",
      "import-x/no-useless-path-segments": "error",
      "import-x/first": "error",
      "import-x/newline-after-import": "error",
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"]],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },
  {
    files: ["**/test/**/*.ts", "**/*.test.ts", "**/*.spec.ts", "e2e/**/*.ts"],
    rules: {
      "max-lines-per-function": "off",
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    files: ["**/*.astro"],
    languageOptions: { parserOptions: { projectService: false, project: true } },
  },
  {
    files: ["apps/worker/src/logging/log.ts"],
    rules: { "no-console": "off" },
  },
  {
    files: ["*.config.ts", "**/*.config.ts", "**/*.config.mjs"],
    rules: {
      "import-x/no-default-export": "off",
    },
  },
  prettier,
);
