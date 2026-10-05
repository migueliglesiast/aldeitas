#!/usr/bin/env node
/**
 * Generate Prisma client for the active DATABASE_URL provider.
 * Hostinger/Neon → postgres schema; local/tests → sqlite schema.
 */
const { execFileSync } = require("node:child_process");

const url = process.env.DATABASE_URL || "";
const isPostgres = /^postgres(ql)?:\/\//i.test(url);
const schema = isPostgres
  ? "prisma/schema.postgres.prisma"
  : "prisma/schema.prisma";

console.log(
  `[prisma] generate using ${schema} (${isPostgres ? "postgres" : "sqlite"})`
);
const prismaCli = require.resolve("prisma/build/index.js");
execFileSync(process.execPath, [prismaCli, "generate", "--schema", schema], {
  stdio: "inherit",
});
