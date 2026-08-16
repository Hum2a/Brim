import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));
const dist = resolve(root, "dist");
const webOrigin = process.env.BRIM_WEB_ORIGIN ?? "http://localhost:5173";

export default defineConfig({
  define: {
    __WEB_ORIGIN__: JSON.stringify(webOrigin),
  },
  build: {
    emptyOutDir: true,
    outDir: dist,
    lib: {
      entry: resolve(root, "src/background.ts"),
      name: "brimExtension",
      formats: ["iife"],
      fileName: () => "background.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    {
      name: "brim-extension-static",
      buildStart() {
        console.log(`Load unpacked from: ${dist}`);
      },
      closeBundle() {
        mkdirSync(dist, { recursive: true });
        copyFileSync(resolve(root, "manifest.json"), resolve(dist, "manifest.json"));
        copyFileSync(resolve(root, "src/popup.html"), resolve(dist, "popup.html"));
      },
    },
  ],
});
