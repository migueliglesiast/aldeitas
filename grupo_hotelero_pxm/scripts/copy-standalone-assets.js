#!/usr/bin/env node
/**
 * Copy static assets into Next.js standalone output (required after next build).
 */
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");

if (!fs.existsSync(standaloneDir)) {
  console.log("[standalone] skip — no .next/standalone (output: standalone not enabled)");
  process.exit(0);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true });
  console.log("[standalone] copied %s → %s", src, dest);
}

copyDir(path.join(root, "public"), path.join(standaloneDir, "public"));
copyDir(
  path.join(root, ".next", "static"),
  path.join(standaloneDir, ".next", "static")
);

console.log("[standalone] assets ready");
