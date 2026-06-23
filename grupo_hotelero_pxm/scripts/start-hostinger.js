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

function fatal(message, error) {
  console.error("[aldeitas] FATAL:", message);
  if (error) console.error(error);
  process.exit(1);
}

process.on("uncaughtException", (error) => fatal("uncaughtException", error));
process.on("unhandledRejection", (error) => fatal("unhandledRejection", error));

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
  fatal(
    `missing .next build at ${buildIdPath} — confirm root directory is grupo_hotelero_pxm and build succeeded`
  );
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
    fatal("standalone server failed to start", error);
  }
} else {
  console.log("[aldeitas] standalone missing — falling back to app.js");
  try {
    require(path.join(appRoot, "app.js"));
  } catch (error) {
    fatal("app.js fallback failed to start", error);
  }
}
