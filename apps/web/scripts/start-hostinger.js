#!/usr/bin/env node
/**
 * Hostinger start:
 * - Default: app.js (custom Next server on PORT / 0.0.0.0) — use with Framework Other + entry app.js/server.js
 * - HOSTINGER_STANDALONE=1: nested monorepo standalone server.js
 */
const fs = require("node:fs");
const path = require("node:path");

const appRoot = path.join(__dirname, "..");
const useStandalone = process.env.HOSTINGER_STANDALONE === "1";

function resolvePort() {
  const args = process.argv.slice(2);
  const flag = args.indexOf("-p");
  if (flag !== -1 && args[flag + 1]) {
    process.env.PORT = args[flag + 1];
  }
  process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
}

function resolveStandaloneServer() {
  const candidates = [
    path.join(appRoot, ".next", "standalone", "apps", "web", "server.js"),
    path.join(appRoot, ".next", "standalone", "server.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const standaloneRoot = path.join(appRoot, ".next", "standalone");
  if (!fs.existsSync(standaloneRoot)) return null;

  try {
    const entries = fs.readdirSync(standaloneRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === "node_modules") continue;
      const nested = path.join(standaloneRoot, entry.name, "server.js");
      if (fs.existsSync(nested)) return nested;
      const nestedApp = path.join(standaloneRoot, entry.name, "web", "server.js");
      if (fs.existsSync(nestedApp)) return nestedApp;
    }
  } catch {
    // ignore
  }

  return null;
}

function logError(label, error) {
  console.error("[aldeitas] %s:", label);
  if (error) console.error(error);
}

process.on("uncaughtException", (error) => logError("uncaughtException", error));
process.on("unhandledRejection", (error) => logError("unhandledRejection", error));

resolvePort();

if (!useStandalone) {
  console.log("[aldeitas] using app.js (set HOSTINGER_STANDALONE=1 for standalone)");
  require(path.join(appRoot, "app.js"));
} else {
  const standaloneServer = resolveStandaloneServer();
  console.log(
    "[aldeitas] boot cwd=%s node=%s port=%s standalone=%s",
    appRoot,
    process.version,
    process.env.PORT || "3000",
    Boolean(standaloneServer)
  );

  if (!standaloneServer) {
    console.error(
      "[aldeitas] FATAL: standalone requested but .next/standalone missing — run npm run build:standalone"
    );
    process.exit(1);
  }

  console.log("[aldeitas] starting standalone server at %s", standaloneServer);
  try {
    process.chdir(path.dirname(standaloneServer));
    require(standaloneServer);
  } catch (error) {
    console.error("[aldeitas] FATAL: standalone server failed to start");
    console.error(error);
    process.exit(1);
  }
}
