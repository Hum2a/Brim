import { spawn } from "node:child_process";

// Same-origin deploy: the API Worker serves the SPA, so the browser calls /v1 on this host.
const apiBase = process.argv[2] ?? process.env.VITE_API_BASE ?? "";
const child = spawn("npx", ["vite", "build"], {
  cwd: new URL("../apps/web", import.meta.url),
  stdio: "inherit",
  shell: true,
  env: { ...process.env, VITE_API_BASE: apiBase },
});
child.on("exit", (code) => process.exit(code ?? 1));
