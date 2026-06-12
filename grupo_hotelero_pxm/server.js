#!/usr/bin/env node
/**
 * Hostinger / shared-hosting entry point.
 * Binds Next.js to Hostinger's PORT and logs startup env for deploy debugging.
 */
const { spawn } = require("node:child_process");
const path = require("node:path");

const port = String(process.env.PORT || "3000");
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
