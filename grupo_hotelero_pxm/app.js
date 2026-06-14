#!/usr/bin/env node
/**
 * Hostinger entry file (Framework "Other" → set entry file to app.js).
 * Starts Next.js in-process — no child spawn (shared hosting process limits).
 *
 * With Framework "Next.js", Hostinger uses `npm run start -- -p $PORT` instead.
 */
function resolvePort() {
  if (process.env.PORT) return String(process.env.PORT);
  const args = process.argv.slice(2);
  const shortFlag = args.indexOf("-p");
  if (shortFlag !== -1 && args[shortFlag + 1]) return args[shortFlag + 1];
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

process.env.PORT = port;
process.env.HOSTNAME = hostname;

process.argv = [
  process.argv[0],
  require.resolve("next/dist/bin/next"),
  "start",
  "-H",
  hostname,
  "-p",
  port,
];

require("next/dist/bin/next");
