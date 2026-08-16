import config from "@brim/config/eslint";

export default [
  ...config,
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-globals": ["error", "fetch"],
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now", message: "pass time in; engine is pure" },
        { object: "process", property: "env", message: "no env reads in the engine" },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: ["fs", "node:fs", "node:fs/promises", "node:http", "undici"],
          patterns: ["@brim/routing", "hono", "wrangler"],
        },
      ],
    },
  },
];
