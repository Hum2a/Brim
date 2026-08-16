import config from "@brim/config/eslint";

export default [
  ...config,
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.test.ts", "src/logger.ts"],
    rules: {
      "no-console": "error",
    },
  },
];
