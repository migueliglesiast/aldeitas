import { describe, it, expect, vi } from "vitest";

const constructor = vi.fn();

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    constructor(options: unknown) {
      constructor(options);
    }
  },
}));

describe("prisma client", () => {
  it("creates a single client and caches it on globalThis outside production", async () => {
    const { prisma } = await import("@/lib/prisma");

    expect(constructor).toHaveBeenCalledWith({ log: ["error", "warn"] });
    expect((globalThis as { prisma?: unknown }).prisma).toBe(prisma);

    vi.resetModules();
    const again = await import("@/lib/prisma");
    expect(again.prisma).toBe(prisma);
    expect(constructor).toHaveBeenCalledTimes(1);
  });
});
