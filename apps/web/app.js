#!/usr/bin/env node
/**
 * Hostinger entry — explicit dir, BUILD_ID check, and clear fatal logs.
 */
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { parse } = require("node:url");

const appDir = __dirname;
const buildIdPath = path.join(appDir, ".next", "BUILD_ID");

function resolvePort() {
  if (process.env.PORT) return Number(process.env.PORT);
  const args = process.argv.slice(2);
  const flag = args.indexOf("-p");
  if (flag !== -1 && args[flag + 1]) return Number(args[flag + 1]);
  return 3000;
}

function logError(label, error) {
  console.error("[aldeitas] %s:", label);
  if (error) console.error(error);
}

function fatal(message, error) {
  console.error("[aldeitas] FATAL:", message);
  if (error) console.error(error);
  process.exit(1);
}

process.on("uncaughtException", (error) => logError("uncaughtException", error));
process.on("unhandledRejection", (error) => logError("unhandledRejection", error));

const port = resolvePort();
const hostname = "0.0.0.0";

console.log("[aldeitas] boot cwd=%s node=%s port=%s", appDir, process.version, port);
console.log(
  "[aldeitas] env DATABASE_URL=%s DIRECT_URL=%s NODE_ENV=%s",
  Boolean(process.env.DATABASE_URL),
  Boolean(process.env.DIRECT_URL),
  process.env.NODE_ENV || "undefined"
);

if (!fs.existsSync(buildIdPath)) {
  fatal(
    `missing .next build at ${buildIdPath} — confirm root directory is apps/web and build succeeded`
  );
}

process.env.PORT = String(port);
process.env.HOSTNAME = hostname;

let next;
try {
  next = require("next");
} catch (error) {
  fatal("cannot require('next') — run npm install in app root", error);
}

function scheduleBookingReconcile() {
  const secret = process.env.BOOKING_RECONCILE_SECRET;
  const minutes = Number(process.env.BOOKING_RECONCILE_INTERVAL_MINUTES || 5);
  if (!secret || !Number.isFinite(minutes) || minutes <= 0) return;

  const url = `http://127.0.0.1:${port}/api/bookings/reconcile`;
  const run = () =>
    fetch(url, { method: "POST", headers: { "x-booking-reconcile-secret": secret } })
      .then((res) => {
        if (!res.ok) console.error("[aldeitas] booking reconcile returned %s", res.status);
      })
      .catch((error) => logError("booking reconcile", error));

  setInterval(run, minutes * 60 * 1000).unref();
  console.log("[aldeitas] booking reconcile every %s min", minutes);
}

const app = next({ dev: false, dir: appDir, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => {
        handle(req, res, parse(req.url, true));
      })
      .listen(port, hostname, () => {
        console.log("[aldeitas] Ready on http://%s:%s", hostname, port);
        scheduleBookingReconcile();
      })
      .on("error", (error) => fatal("listen error", error));
  })
  .catch((error) => fatal("prepare failed", error));
