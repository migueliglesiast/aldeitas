#!/usr/bin/env node
/**
 * Hostinger start: prefer standalone server (lower memory), fall back to app.js.
 */
const fs = require("node:fs");
const path = require("node:path");

const appRoot = path.join(__dirname, "..");
const standaloneServer = path.join(appRoot, ".next", "standalone", "server.js");
const buildIdPath = path.join(appRoot, ".next", "BUILD_ID");

function resolvePort() {
  const args = process.argv.slice(2);
  const flag = args.indexOf("-p");
  if (flag !== -1 && args[flag + 1]) {
    process.env.PORT = args[flag + 1];
  }
  process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
}

function logError(label, error) {
  console.error("[aldeitas] %s:", label);
  if (error) console.error(error);
}

// Log only — do not process.exit on rejections (Next/React can emit benign ones).
process.on("uncaughtException", (error) => logError("uncaughtException", error));
process.on("unhandledRejection", (error) => logError("unhandledRejection", error));

resolvePort();

console.log(
  "[aldeitas] boot cwd=%s node=%s port=%s standalone=%s",
  appRoot,
  process.version,
  process.env.PORT || "3000",
  fs.existsSync(standaloneServer)
);
console.log(
  "[aldeitas] env DATABASE_URL=%s DIRECT_URL=%s NODE_ENV=%s",
  Boolean(process.env.DATABASE_URL),
  Boolean(process.env.DIRECT_URL),
  process.env.NODE_ENV || "undefined"
);

if (!fs.existsSync(buildIdPath)) {
  console.error(
    "[aldeitas] FATAL: missing .next build at %s — confirm root directory is grupo_hotelero_pxm and build succeeded",
    buildIdPath
  );
  process.exit(1);
}

if (fs.existsSync(standaloneServer)) {
  console.log(
    "[aldeitas] starting standalone server on port %s",
    process.env.PORT || "3000"
  );
  try {
    process.chdir(path.dirname(standaloneServer));
    require(standaloneServer);
  } catch (error) {
    console.error("[aldeitas] FATAL: standalone server failed to start");
    console.error(error);
    process.exit(1);
  }
} else {
  console.log("[aldeitas] standalone missing — falling back to app.js");
  try {
    require(path.join(appRoot, "app.js"));
  } catch (error) {
    console.error("[aldeitas] FATAL: app.js fallback failed to start");
    console.error(error);
    process.exit(1);
  }
}
