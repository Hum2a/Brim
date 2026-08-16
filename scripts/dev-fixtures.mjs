#!/usr/bin/env node
import { spawn } from "node:child_process";

const env = { ...process.env, BRIM_FIXTURES: "1" };

const api = spawn("npm", ["run", "dev", "-w", "@brim/api", "--", "--var", "BRIM_FIXTURES:1"], {
  stdio: "inherit",
  env,
  shell: true,
});
const web = spawn("npm", ["run", "dev", "-w", "@brim/web"], {
  stdio: "inherit",
  env,
  shell: true,
});

function shutdown(code) {
  api.kill();
  web.kill();
  process.exit(code);
}

api.on("exit", (code) => shutdown(code ?? 1));
web.on("exit", (code) => shutdown(code ?? 1));
