#!/usr/bin/env node
/**
 * Require an explicit environment target for db:* and data:* commands.
 * Usage: node scripts/with-env.mjs <dev|staging|prod> -- <command...>
 */
const ALLOWED = new Set(["dev", "staging", "prod"]);

const args = process.argv.slice(2);
const sep = args.indexOf("--");
const envName = sep === -1 ? args[0] : args[0];
const command = sep === -1 ? [] : args.slice(sep + 1);

if (!envName || envName.startsWith("-") || !ALLOWED.has(envName) || command.length === 0) {
  console.error(
    "with-env: environment is required and must be explicit.\n" +
      "Usage: node scripts/with-env.mjs <dev|staging|prod> -- <command>\n" +
      "Never infer the target. Refusing to run.",
  );
  process.exit(1);
}

const { spawn } = await import("node:child_process");
const child = spawn(command[0], command.slice(1), {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, BRIM_ENV: envName },
});
child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
