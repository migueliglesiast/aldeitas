#!/usr/bin/env node
/**
 * Hostinger entry file (set "Archivo de entrada" to app.js if asked).
 * Supports: PORT env, or `npm run start -- -p $PORT`
 */
const { spawn } = require("node:child_process");

function resolvePort() {
  if (process.env.PORT) return String(process.env.PORT);
  const args = process.argv.slice(2);
  const shortFlag = args.indexOf("-p");
  if (shortFlag !== -1 && args[shortFlag + 1]) return args[shortFlag + 1];
  return "3000";
}

const port = resolvePort();

console.log("[aldeitas] app.js starting Next.js on 0.0.0.0:%s", port);
console.log(
  "[aldeitas] DATABASE_URL=%s DIRECT_URL=%s NODE_ENV=%s",
  Boolean(process.env.DATABASE_URL),
  Boolean(process.env.DIRECT_URL),
  process.env.NODE_ENV || "undefined"
);

const child = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", port], {
  cwd: __dirname,
  env: { ...process.env, PORT: port, HOSTNAME: "0.0.0.0" },
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code, signal) => {
  console.error("[aldeitas] Next.js exited code=%s signal=%s", code, signal);
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("[aldeitas] failed to start Next.js:", error);
  process.exit(1);
});
