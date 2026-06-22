#!/usr/bin/env node
/**
 * Hostinger start: prefer standalone server (lower memory), fall back to app.js.
 */
const fs = require("node:fs");
const path = require("node:path");

function resolvePort() {
  const args = process.argv.slice(2);
  const flag = args.indexOf("-p");
  if (flag !== -1 && args[flag + 1]) {
    process.env.PORT = args[flag + 1];
  }
  process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
}

resolvePort();

const standaloneServer = path.join(__dirname, "..", ".next", "standalone", "server.js");

if (fs.existsSync(standaloneServer)) {
  console.log(
    "[aldeitas] starting standalone server on port %s",
    process.env.PORT || "3000"
  );
  process.chdir(path.dirname(standaloneServer));
  require(standaloneServer);
} else {
  console.log("[aldeitas] standalone missing — falling back to app.js");
  require("../app.js");
}
