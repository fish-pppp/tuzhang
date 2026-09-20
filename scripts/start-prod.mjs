#!/usr/bin/env node
/**
 * Production entry for the Docker / VPS image: apply SQL migrations, then
 * start the Nitro `node-server` bundle. Vercel still migrates during `build`.
 */
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

const migrate = spawnSync(process.execPath, [join(here, "migrate.mjs")], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

const server = spawn(process.execPath, [join(repoRoot, ".output/server/index.mjs")], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

const stop = (signal) => {
  if (!server.killed) server.kill(signal);
};

process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));

server.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
