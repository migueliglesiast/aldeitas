import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = {
  $queryRaw: vi.fn(),
  listing: { findMany: vi.fn(), findUnique: vi.fn() },
  hotel: { findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { getHotelsWithListings, getListingDetail, getHotelDetail } = await import("@/lib/data");

describe("getHotelsWithListings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attaches the listings of every hotel", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { id: "h1", name: "Hotel 1" },
      { id: "h2", name: "Hotel 2" },
    ]);
    prismaMock.listing.findMany
      .mockResolvedValueOnce([{ id: "l1" }])
      .mockResolvedValueOnce([]);

    const hotels = await getHotelsWithListings();

    expect(hotels).toEqual([
      { id: "h1", name: "Hotel 1", listings: [{ id: "l1" }] },
      { id: "h2", name: "Hotel 2", listings: [] },
    ]);
    expect(prismaMock.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { hotelId: "h1" } })
    );
  });

  it("returns an empty list when there are no hotels", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    await expect(getHotelsWithListings()).resolves.toEqual([]);
    expect(prismaMock.listing.findMany).not.toHaveBeenCalled();
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
