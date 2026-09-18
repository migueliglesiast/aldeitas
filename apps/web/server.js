#!/usr/bin/env node
/**
 * Hostinger entry shim — panels that look for server.js boot the same
 * custom server as app.js (PORT + 0.0.0.0). Do not use standalone here.
 */
require("./app.js");
