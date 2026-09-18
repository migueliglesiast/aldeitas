#!/usr/bin/env node
/**
 * Copy static assets into Next.js standalone output (required after next build).
 * Monorepo: server lives at .next/standalone/apps/web/server.js
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

function resolveStandaloneAppDir() {
  const nested = path.join(standaloneDir, "apps", "web");
  if (fs.existsSync(path.join(nested, "server.js"))) return nested;
  if (fs.existsSync(path.join(standaloneDir, "server.js"))) return standaloneDir;

  try {
    for (const entry of fs.readdirSync(standaloneDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules") continue;
      const candidate = path.join(standaloneDir, entry.name);
      if (fs.existsSync(path.join(candidate, "server.js"))) return candidate;
      const nestedWeb = path.join(candidate, "web");
      if (fs.existsSync(path.join(nestedWeb, "server.js"))) return nestedWeb;
    }
  } catch {
    // ignore
  }

  return standaloneDir;
}

const appDir = resolveStandaloneAppDir();
console.log("[standalone] app dir=%s", appDir);

copyDir(path.join(root, "public"), path.join(appDir, "public"));
copyDir(
  path.join(root, ".next", "static"),
  path.join(appDir, ".next", "static")
);

// Also keep top-level copies for older start scripts.
copyDir(path.join(root, "public"), path.join(standaloneDir, "public"));
copyDir(
  path.join(root, ".next", "static"),
  path.join(standaloneDir, ".next", "static")
);

// Ensure IMAP/mail packages exist in standalone (Hostinger chdirs into standalone app dir).
const packagesToMirror = [
  "imapflow",
  "mailparser",
  "nodemailer",
  "cloudinary",
  "he",
  "htmlparser2",
  "iconv-lite",
  "libmime",
  "linkify-it",
  "tlds",
  "punycode.js",
  "encoding-japanese",
  "peberminta",
  "libqp",
  "libbase64",
  "domutils",
  "domelementtype",
  "domhandler",
  "entities",
  "html-to-text",
  "selderee",
  "@selderee/plugin-htmlparser2",
  "parseley",
  "leac",
  "uc.micro",
];

function mirrorPackages(targetNodeModules) {
  const rootNodeModules = path.join(root, "node_modules");
  const workspaceNodeModules = path.join(root, "..", "..", "node_modules");
  fs.mkdirSync(targetNodeModules, { recursive: true });

  for (const name of packagesToMirror) {
    const dest = path.join(targetNodeModules, name);
    if (fs.existsSync(dest)) continue;
    const src =
      [rootNodeModules, workspaceNodeModules]
        .map((base) => path.join(base, name))
        .find((candidate) => fs.existsSync(candidate)) || null;
    if (!src) continue;
    copyDir(src, dest);
  }
}

mirrorPackages(path.join(standaloneDir, "node_modules"));
mirrorPackages(path.join(appDir, "node_modules"));

console.log("[standalone] assets ready");
