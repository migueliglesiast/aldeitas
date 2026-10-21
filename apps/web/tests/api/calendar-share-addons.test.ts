// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = {
  hotelCalendarShare: { findUnique: vi.fn() },
  bookingAddon: { findFirst: vi.fn(), update: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { PATCH } = await import("@/app/api/calendar/share/[token]/addons/route");

function patch(body: unknown) {
  return PATCH(
    new NextRequest("http://localhost/api/calendar/share/tok/addons", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ token: "tok" }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.hotelCalendarShare.findUnique.mockResolvedValue({ hotelId: "h1" });
});

describe("PATCH /api/calendar/share/[token]/addons", () => {
  it("marks an extra of this hotel as delivered", async () => {
    prismaMock.bookingAddon.findFirst.mockResolvedValue({ id: "ba1" });
    prismaMock.bookingAddon.update.mockResolvedValue({ id: "ba1", deliveredAt: new Date() });
    const res = await patch({ addonId: "ba1", delivered: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "ba1", delivered: true });
    expect(prismaMock.bookingAddon.findFirst).toHaveBeenCalledWith({
      where: { id: "ba1", booking: { listing: { hotelId: "h1" } } },
      select: { id: true },
    });
    expect(prismaMock.bookingAddon.update.mock.calls[0][0].data.deliveredAt).toBeInstanceOf(Date);
  });

  it("clears the delivered mark", async () => {
    prismaMock.bookingAddon.findFirst.mockResolvedValue({ id: "ba1" });
    prismaMock.bookingAddon.update.mockResolvedValue({ id: "ba1", deliveredAt: null });
    const res = await patch({ addonId: "ba1", delivered: false });
    expect(await res.json()).toEqual({ id: "ba1", delivered: false });
    expect(prismaMock.bookingAddon.update.mock.calls[0][0].data).toEqual({ deliveredAt: null });
  });

  it("rejects unknown links, other hotels' extras and bad bodies", async () => {
    prismaMock.hotelCalendarShare.findUnique.mockResolvedValueOnce(null);
    expect((await patch({ addonId: "ba1", delivered: true })).status).toBe(404);
    prismaMock.bookingAddon.findFirst.mockResolvedValue(null);
    expect((await patch({ addonId: "ba9", delivered: true })).status).toBe(404);
    expect((await patch({ addonId: "ba1" })).status).toBe(400);
    expect(prismaMock.bookingAddon.update).not.toHaveBeenCalled();
  });
});
