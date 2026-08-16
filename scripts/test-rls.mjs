#!/usr/bin/env node
import { spawn } from "node:child_process";

const child = spawn("npm", ["run", "test", "-w", "@brim/api", "--", "src/db/rls.test.ts"], {
  stdio: "inherit",
  shell: true,
});
child.on("exit", (code) => {
  if (code) process.exit(code);
  if (!process.env.DATABASE_URL) {
    console.log("test:rls: memory isolation passed. Live Neon suite skipped (no DATABASE_URL).");
    process.exit(0);
  }
  console.log("test:rls: DATABASE_URL present — apply 0001_init.sql on a Neon branch and re-run subject SET brim.owner_id checks there.");
  process.exit(0);
});
