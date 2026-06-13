#!/usr/bin/env node
/**
 * Hostinger entry point — reads PORT from env or `-p` CLI (npm run start -- -p $PORT).
 */
const { spawn } = require("node:child_process");

function resolvePort() {
  if (process.env.PORT) return String(process.env.PORT);
  const args = process.argv.slice(2);
  const shortFlag = args.indexOf("-p");
  if (shortFlag !== -1 && args[shortFlag + 1]) return args[shortFlag + 1];
  const longFlag = args.indexOf("--port");
  if (longFlag !== -1 && args[longFlag + 1]) return args[longFlag + 1];
  return "3000";
}

const port = resolvePort();
const hostname = "0.0.0.0";

console.log("[aldeitas] starting Next.js on %s:%s", hostname, port);
console.log(
  "[aldeitas] env: DATABASE_URL=%s DIRECT_URL=%s NODE_ENV=%s",
  Boolean(process.env.DATABASE_URL),
  Boolean(process.env.DIRECT_URL),
  process.env.NODE_ENV || "undefined"
);

const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "start", "-H", hostname, "-p", port], {
  cwd: __dirname,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  console.error("[aldeitas] Next.js exited code=%s signal=%s", code, signal);
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("[aldeitas] failed to spawn Next.js:", error);
  process.exit(1);
});
