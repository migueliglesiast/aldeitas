import { describe, it, expect, vi } from "vitest";
import { addDays } from "date-fns";
import { parseDateKey, toDateKey } from "@/lib/calendar-dates";

const prismaMock = { hotel: { findUnique: vi.fn() } };

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/airbnb", () => ({ fetchIcalBlocks: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/listing-pricing", () => ({
  getListingDailyPriceMap: vi.fn().mockResolvedValue(new Map()),
}));

const { buildHotelCalendarData } = await import("@/lib/hotel-calendar-data");

describe("buildHotelCalendarData ghost bookings", () => {
  it("shows ghost bookings and named manual blocks without blocking other days", async () => {
    const today = parseDateKey(toDateKey(new Date()));
    const ghostStart = addDays(today, 2);
    const blockStart = addDays(today, 10);
    prismaMock.hotel.findUnique.mockResolvedValue({
      id: "h1",
      name: "Hotel",
      location: "Puerto",
      listings: [
        {
          id: "l1",
          title: "Unit 7",
          icalUrl: null,
          nightlyBasePrice: 100000,
          baseCurrency: "MXN",
          calendarSources: [],
          guestMetas: [],
          bookings: [],
          manualBlocks: [
            {
              id: "b1",
              startDate: blockStart,
              endDate: addDays(blockStart, 2),
              note: "Lauren Q",
            },
          ],
          ghostBookings: [
            {
              id: "g1",
              startDate: ghostStart,
              endDate: addDays(ghostStart, 3),
              guestName: "Brittan E",
              guestCount: 2,
              payoutCents: 46503,
              payoutCurrency: "USD",
            },
          ],
        },
      ],
    });

    const data = await buildHotelCalendarData("h1", { months: 1 });
    const room = data!.rooms[0];
    const ghostSpan = room.spans.find((span) => span.kind === "ghost");
    expect(ghostSpan).toMatchObject({
      ghostId: "g1",
      guestName: "Brittan E",
      guestCount: 2,
      dayCount: 3,
      payoutCurrency: "USD",
    });
    expect(room.cells[toDateKey(ghostStart)]).toMatchObject({
      status: "ghost",
      ghostId: "g1",
      spanId: "ghost-g1",
    });
    expect(room.cells[toDateKey(addDays(ghostStart, 3))].status).toBe("available");
    expect(room.spans.find((span) => span.kind === "manual_block")?.guestName).toBe(
      "Lauren Q"
    );
  });
});
