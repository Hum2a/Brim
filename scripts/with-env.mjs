#!/usr/bin/env node
/**
 * Require an explicit environment target for db:* and data:* commands.
 * Loads matching .env / .dev.vars into the child without printing values.
 * Usage: node scripts/with-env.mjs <dev|staging|prod> -- <command...>
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENV_TARGETS, loadEnvFor } from './env-file.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Windows `cmd.exe` ignores spawn's argument array when `shell: true`.
 * Join into one command string so flags like `--yes` reach the child.
 */
export function joinShellCommand(argv) {
  return argv
    .map((arg) => {
      if (arg.length === 0) return '""';
      if (!/[\s"&<>|^]/.test(arg)) return arg;
      return `"${String(arg).replaceAll('"', '\\"')}"`;
    })
    .join(' ');
}

function overlayEnv(base, extra) {
  const env = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (value === '' && env[key]) continue;
    env[key] = value;
  }
  return env;
}

function main() {
  const args = process.argv.slice(2);
  const sep = args.indexOf('--');
  const envName = sep === -1 ? args[0] : args[0];
  const command = sep === -1 ? [] : args.slice(sep + 1);

  if (
    !envName ||
    envName.startsWith('-') ||
    !ENV_TARGETS.includes(envName) ||
    command.length === 0
  ) {
    console.error(
      'with-env: environment is required and must be explicit.\n' +
        'Usage: node scripts/with-env.mjs <dev|staging|prod> -- <command>\n' +
        'Never infer the target. Refusing to run.',
    );
    process.exit(1);
  }

  const fromFiles = loadEnvFor(root, envName);
  const env = overlayEnv(fromFiles, process.env);
  env.BRIM_ENV = envName;

  const child = spawn(joinShellCommand(command), {
    stdio: 'inherit',
    shell: true,
    env,
  });
  child.on('exit', (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 1);
  });
}

const invokedDirectly =
  Boolean(process.argv[1]) &&
  path.normalize(path.resolve(process.argv[1])).toLowerCase() ===
    path.normalize(fileURLToPath(import.meta.url)).toLowerCase();
if (invokedDirectly) main();
