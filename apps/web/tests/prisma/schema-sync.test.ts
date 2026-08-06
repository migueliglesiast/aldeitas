import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The SQLite (default) and Postgres schemas must define identical models.
// Only the header comments and the datasource provider may differ.
function modelBody(file: string): string {
  const source = readFileSync(
    path.resolve(__dirname, "../../prisma", file),
    "utf8"
  );
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
    .replace(/datasource db \{[^}]*\}/, "")
    .trim();
}

describe("prisma schema sync", () => {
  it("keeps schema.prisma and schema.postgres.prisma models identical", () => {
    expect(modelBody("schema.postgres.prisma")).toBe(modelBody("schema.prisma"));
  });
});
