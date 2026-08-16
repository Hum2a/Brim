import { spawn } from "node:child_process";

const apiBase = process.argv[2] ?? process.env.VITE_API_BASE ?? "https://brim-api-staging.humzab1711.workers.dev";
const child = spawn("npx", ["vite", "build"], {
  cwd: new URL("../apps/web", import.meta.url),
  stdio: "inherit",
  shell: true,
  env: { ...process.env, VITE_API_BASE: apiBase },
});
child.on("exit", (code) => process.exit(code ?? 1));
