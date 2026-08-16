import config from "@brim/config/eslint";

export default [
  ...config,
  {
    ignores: ["dist/**"],
  },
  {
    files: ["src/background.ts"],
    languageOptions: {
      globals: {
        chrome: "readonly",
        __WEB_ORIGIN__: "readonly",
      },
    },
  },
];
