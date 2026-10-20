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
  if (error && error.cause) console.error(error.cause);
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

/** Hostinger's process manager doesn't expose the app on loopback, so scheduled jobs call the public URL. */
function schedulerBaseUrl() {
  const base = process.env.SCHEDULER_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  return (base || `http://127.0.0.1:${port}`).replace(/\/+$/, "");
}

function scheduleBookingReconcile() {
  const secret = process.env.BOOKING_RECONCILE_SECRET;
  const minutes = Number(process.env.BOOKING_RECONCILE_INTERVAL_MINUTES || 5);
  if (!secret || !Number.isFinite(minutes) || minutes <= 0) return;

  const url = `${schedulerBaseUrl()}/api/bookings/reconcile`;
  const run = () =>
    fetch(url, { method: "POST", headers: { "x-booking-reconcile-secret": secret } })
      .then((res) => {
        if (!res.ok) console.error("[aldeitas] booking reconcile returned %s", res.status);
      })
      .catch((error) => logError("booking reconcile", error));

  setInterval(run, minutes * 60 * 1000).unref();
  console.log("[aldeitas] booking reconcile every %s min", minutes);
}

function scheduleWhatsappTick() {
  const secret = process.env.BOOKING_RECONCILE_SECRET;
  if (!secret || !process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) return;

  const url = `${schedulerBaseUrl()}/api/whatsapp/tick`;
  const run = () =>
    fetch(url, { method: "POST", headers: { "x-booking-reconcile-secret": secret } })
      .then((res) => {
        if (!res.ok) console.error("[aldeitas] whatsapp tick returned %s", res.status);
      })
      .catch((error) => logError("whatsapp tick", error));

  setInterval(run, 60 * 1000).unref();
  console.log("[aldeitas] whatsapp tick every 1 min");
}

function scheduleAirbnbPriceSync() {
  const secret = process.env.BOOKING_RECONCILE_SECRET;
  const hours = Number(process.env.AIRBNB_PRICE_SYNC_INTERVAL_HOURS || 2);
  if (!secret || !Number.isFinite(hours) || hours <= 0) return;

  const url = `${schedulerBaseUrl()}/api/cron/sync-airbnb-prices`;
  const run = () =>
    fetch(url, { method: "POST", headers: { "x-booking-reconcile-secret": secret } })
      .then((res) => {
        if (!res.ok) console.error("[aldeitas] airbnb price sync returned %s", res.status);
      })
      .catch((error) => logError("airbnb price sync", error));

  setTimeout(run, 2 * 60 * 1000).unref();
  setInterval(run, hours * 60 * 60 * 1000).unref();
  console.log("[aldeitas] airbnb price sync every %s h", hours);
}

function scheduleAirbnbReviewSync() {
  const secret = process.env.BOOKING_RECONCILE_SECRET;
  const hours = Number(process.env.AIRBNB_REVIEW_SYNC_INTERVAL_HOURS || 12);
  if (!secret || !Number.isFinite(hours) || hours <= 0) return;

  const url = `${schedulerBaseUrl()}/api/cron/sync-airbnb-reviews`;
  const run = () =>
    fetch(url, { method: "POST", headers: { "x-booking-reconcile-secret": secret } })
      .then((res) => {
        if (!res.ok) console.error("[aldeitas] airbnb review sync returned %s", res.status);
      })
      .catch((error) => logError("airbnb review sync", error));

  setTimeout(run, 5 * 60 * 1000).unref();
  setInterval(run, hours * 60 * 60 * 1000).unref();
  console.log("[aldeitas] airbnb review sync every %s h", hours);
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
        scheduleWhatsappTick();
        scheduleAirbnbPriceSync();
        scheduleAirbnbReviewSync();
      })
      .on("error", (error) => fatal("listen error", error));
  })
  .catch((error) => fatal("prepare failed", error));
