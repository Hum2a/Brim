import config from "@brim/config/eslint";

export default [
  ...config,
  {
    ignores: ["public/**", "dist/**"],
  },
];
