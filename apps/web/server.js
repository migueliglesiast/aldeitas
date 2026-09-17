#!/usr/bin/env node
/**
 * Hostinger entry shim — some panels look for server.js at the app root.
 * Delegates to scripts/start-hostinger.js (standalone Next.js).
 */
require("./scripts/start-hostinger.js");
