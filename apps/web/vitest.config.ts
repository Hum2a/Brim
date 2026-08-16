import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "@brim/config/vitest";

export default mergeConfig(
  base,
  defineConfig({
    plugins: [react()],
    test: {
      environment: "node",
    },
  }),
);
