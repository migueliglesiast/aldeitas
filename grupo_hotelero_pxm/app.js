#!/usr/bin/env node
/**
 * Hostinger entry file.
 * Set Framework to "Other" + entry file `app.js`, OR use `npm run start` (Next.js framework).
 */
const http = require("node:http");
const { parse } = require("node:url");
const next = require("next");

function resolvePort() {
  if (process.env.PORT) return Number(process.env.PORT);
  const args = process.argv.slice(2);
  const shortFlag = args.indexOf("-p");
  if (shortFlag !== -1 && args[shortFlag + 1]) return Number(args[shortFlag + 1]);
  return 3000;
}

const port = resolvePort();
const hostname = "0.0.0.0";

console.log("[aldeitas] boot node=%s port=%s", process.version, port);
console.log(
  "[aldeitas] env DATABASE_URL=%s DIRECT_URL=%s NODE_ENV=%s",
  Boolean(process.env.DATABASE_URL),
  Boolean(process.env.DIRECT_URL),
  process.env.NODE_ENV || "undefined"
);

process.env.PORT = String(port);
process.env.HOSTNAME = hostname;

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
      })
      .listen(port, hostname, () => {
        console.log("[aldeitas] Ready on http://%s:%s", hostname, port);
      })
      .on("error", (error) => {
        console.error("[aldeitas] listen error:", error);
        process.exit(1);
      });
  })
  .catch((error) => {
    console.error("[aldeitas] prepare failed:", error);
    process.exit(1);
  });
