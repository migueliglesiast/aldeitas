#!/usr/bin/env node
/**
 * npm workspaces hoist dependencies to the monorepo root, but Hostinger only
 * ships the app root directory (apps/web), so the deployed process cannot
 * resolve `next`. Install the production dependencies into apps/web and
 * regenerate the Prisma client there so the deployed directory is
 * self-contained.
 *
 * The install runs in a scratch directory outside the monorepo: inside it npm
 * would resolve the workspace root and write to the root node_modules instead.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const appDir = path.join(__dirname, "..");
const appModules = path.join(appDir, "node_modules");

function run(command, cwd) {
  console.log("[runtime-deps] %s (cwd=%s)", command, cwd);
  execSync(command, { cwd, stdio: "inherit" });
}

if (fs.existsSync(path.join(appModules, "next"))) {
  console.log("[runtime-deps] apps/web/node_modules/next already present");
  process.exit(0);
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "aldeitas-runtime-deps-"));
try {
  fs.copyFileSync(path.join(appDir, "package.json"), path.join(scratch, "package.json"));
  run("npm install --omit=dev --no-audit --no-fund --no-package-lock --ignore-scripts", scratch);
  fs.mkdirSync(appModules, { recursive: true });
  fs.cpSync(path.join(scratch, "node_modules"), appModules, { recursive: true, force: true });
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

run("node scripts/prisma-generate-for-env.js", appDir);

for (const required of ["next", ".prisma/client", "@prisma/client"]) {
  const target = path.join(appModules, required);
  if (!fs.existsSync(target)) {
    console.error("[runtime-deps] FATAL: %s missing", target);
    process.exit(1);
  }
}
console.log("[runtime-deps] apps/web is self-contained");
