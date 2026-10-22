import type { Config } from "stylelint";

import { noCommentsPlugin } from "@zsm3/lint-rules/stylelint";

const config: Config = {
  extends: ["stylelint-config-standard"],
  plugins: [noCommentsPlugin, "stylelint-declaration-strict-value"],
  ignoreFiles: ["**/dist/**", "**/coverage/**", "**/reports/**", "**/.astro/**"],
  reportNeedlessDisables: true,
  reportInvalidScopeDisables: true,
  reportDescriptionlessDisables: true,
  rules: {
    "local/no-comments": true,
    "custom-property-empty-line-before": null,
    "scale-unlimited/declaration-strict-value": [
      [
        "/color$/",
        "fill",
        "stroke",
        "font-family",
        "font-size",
        "z-index",
        "/^(margin|padding|gap|row-gap|column-gap|inset)/",
        "border-radius",
        "/duration$/",
      ],
      {
        ignoreValues: [
          "0",
          "auto",
          "inherit",
          "initial",
          "unset",
          "currentColor",
          "transparent",
          "none",
          "100%",
          "50%",
        ],
        disableFix: true,
      },
    ],
    "color-named": "never",
    "color-no-hex": true,
    "function-disallowed-list": ["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch"],
  },
  overrides: [
    { files: ["**/*.astro"], customSyntax: "postcss-html" },
    {
      files: ["**/styles/tokens.css"],
      rules: {
        "color-no-hex": null,
        "function-disallowed-list": null,
        "scale-unlimited/declaration-strict-value": null,
      },
    },
  ],
};

export default config;
