#!/usr/bin/env node
/**
 * Hostinger entry file. Works with:
 * - Framework "Other" + entry file `app.js`
 * - Framework "Next.js" via `npm run start` (package.json points here)
 *
 * Resolves PORT from env or `npm run start -- -p $PORT`.
 */
const { spawn } = require("node:child_process");
const { join } = require("node:path");

function resolvePort() {
  if (process.env.PORT) return String(process.env.PORT);
  const args = process.argv.slice(2);
  const shortFlag = args.indexOf("-p");
  if (shortFlag !== -1 && args[shortFlag + 1]) return args[shortFlag + 1];
  return "3000";
}

const port = resolvePort();
const nextBin = join(__dirname, "node_modules", ".bin", "next");

console.log("[aldeitas] starting Next.js on 0.0.0.0:%s", port);
console.log(
  "[aldeitas] env: DATABASE_URL=%s DIRECT_URL=%s NODE_ENV=%s",
  Boolean(process.env.DATABASE_URL),
  Boolean(process.env.DIRECT_URL),
  process.env.NODE_ENV || "undefined"
);

const child = spawn(nextBin, ["start", "-H", "0.0.0.0", "-p", port], {
  cwd: __dirname,
  env: { ...process.env, PORT: port, HOSTNAME: "0.0.0.0" },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  console.error("[aldeitas] Next.js exited code=%s signal=%s", code, signal);
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("[aldeitas] failed to start Next.js:", error);
  process.exit(1);
});
