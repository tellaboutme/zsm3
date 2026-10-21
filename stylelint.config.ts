import type { Config } from "stylelint";

import { noCommentsPlugin } from "@zsm3/lint-rules/stylelint";

const config: Config = {
  extends: ["stylelint-config-standard"],
  plugins: [noCommentsPlugin],
  ignoreFiles: ["**/dist/**", "**/coverage/**", "**/reports/**", "**/.astro/**"],
  reportNeedlessDisables: true,
  reportInvalidScopeDisables: true,
  reportDescriptionlessDisables: true,
  rules: {
    "local/no-comments": true,
    "custom-property-empty-line-before": null,
    "color-named": "never",
    "color-no-hex": true,
    "function-disallowed-list": ["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch"],
  },
  overrides: [
    { files: ["**/*.astro"], customSyntax: "postcss-html" },
    {
      files: ["**/styles/tokens.css"],
      rules: { "color-no-hex": null, "function-disallowed-list": null },
    },
  ],
};

export default config;
