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

// Ensure IMAP/mail packages exist in standalone (Hostinger chdirs into standalone/).
const packagesToMirror = ["imapflow", "mailparser", "nodemailer", "he", "htmlparser2", "iconv-lite", "libmime", "linkify-it", "tlds", "punycode.js", "encoding-japanese", "peberminta", "libqp", "libbase64", "domutils", "domelementtype", "domhandler", "entities", "html-to-text", "selderee", "@selderee/plugin-htmlparser2", "parseley", "leac", "uc.micro"];
const rootNodeModules = path.join(root, "node_modules");
const standaloneNodeModules = path.join(standaloneDir, "node_modules");
fs.mkdirSync(standaloneNodeModules, { recursive: true });

for (const name of packagesToMirror) {
  const src = path.join(rootNodeModules, name);
  const dest = path.join(standaloneNodeModules, name);
  if (!fs.existsSync(src)) continue;
  if (fs.existsSync(dest)) continue;
  copyDir(src, dest);
}

console.log("[standalone] assets ready");
