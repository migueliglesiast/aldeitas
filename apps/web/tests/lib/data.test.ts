import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = {
  listing: { findUnique: vi.fn() },
  hotel: { findMany: vi.fn(), findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { getHotelsWithListings, getListingDetail, getHotelDetail } = await import("@/lib/data");

describe("getHotelsWithListings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attaches the listings of every hotel", async () => {
    prismaMock.hotel.findMany.mockResolvedValue([
      { id: "h1", name: "Hotel 1", listings: [{ id: "l1" }] },
      { id: "h2", name: "Hotel 2", listings: [] },
    ]);

    const hotels = await getHotelsWithListings();

    expect(hotels).toEqual([
      { id: "h1", name: "Hotel 1", listings: [{ id: "l1" }] },
      { id: "h2", name: "Hotel 2", listings: [] },
    ]);
    expect(prismaMock.hotel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { listings: { include: { images: { orderBy: { position: "asc" } } } } },
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("returns an empty list when there are no hotels", async () => {
    prismaMock.hotel.findMany.mockResolvedValue([]);
    await expect(getHotelsWithListings()).resolves.toEqual([]);
  });
});

describe("detail queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getListingDetail loads images and the parent hotel", async () => {
    prismaMock.listing.findUnique.mockResolvedValue({ id: "l1" });

    await expect(getListingDetail("l1")).resolves.toEqual({ id: "l1" });
    expect(prismaMock.listing.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "l1" } })
    );
  });

  it("getHotelDetail loads listings with their images", async () => {
    prismaMock.hotel.findUnique.mockResolvedValue(null);

    await expect(getHotelDetail("h1")).resolves.toBeNull();
    expect(prismaMock.hotel.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "h1" } })
    );
  });
});
