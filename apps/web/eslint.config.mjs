import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import sonarjs from "eslint-plugin-sonarjs";
import security from "eslint-plugin-security";

const config = [
  {
    ignores: [
      "coverage/**",
      ".next/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  sonarjs.configs.recommended,
  security.configs.recommended,
  {
    // Rules introduced by sonarjs v3 / react-hooks v7 that flag pre-existing
    // patterns; downgraded to warnings pending dedicated cleanup.
    rules: {
      "sonarjs/cognitive-complexity": "warn",
      "sonarjs/no-nested-conditional": "warn",
      "sonarjs/no-nested-functions": "warn",
      "sonarjs/no-dead-store": "warn",
      "sonarjs/no-redundant-assignments": "warn",
      "sonarjs/no-unused-vars": "warn",
      "sonarjs/unused-import": "warn",
      "sonarjs/no-ignored-exceptions": "warn",
      "sonarjs/no-empty-collection": "warn",
      "sonarjs/pseudo-random": "warn",
      "sonarjs/slow-regex": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["tests/**", "e2e/**", "eslint.config.mjs"],
    rules: {
      "sonarjs/no-hardcoded-passwords": "off",
      "sonarjs/no-clear-text-protocols": "off",
      "sonarjs/public-static-readonly": "off",
    },
  },
];

export default config;
