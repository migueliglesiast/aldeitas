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

describe("buildHotelCalendarData add-ons", () => {
  it("puts booking extras on the span without prices and skips canceled Airbnb stays", async () => {
    const today = parseDateKey(toDateKey(new Date()));
    const start = addDays(today, 3);
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
          manualBlocks: [],
          ghostBookings: [],
          bookings: [
            {
              id: "bk1",
              startDate: start,
              endDate: addDays(start, 3),
              status: "CONFIRMED",
              authorizedAt: new Date(),
              guestName: "Ana",
              guestEmail: "ana@example.com",
              guestPhone: null,
              guestCount: 2,
              addons: [
                {
                  id: "ba1",
                  name: "Renta de vehículo",
                  unit: "day",
                  quantity: 2,
                  option: "Scooter",
                  rentalStart: start,
                  rentalEnd: addDays(start, 1),
                  unitPriceCents: 50000,
                  totalCents: 100000,
                  providerName: "Motos Zicatela",
                  providerPhone: "+52 954 000 0000",
                  deliveredAt: null,
                },
                {
                  id: "ba2",
                  name: "Cerveza en el refri",
                  unit: "item",
                  quantity: 1,
                  option: null,
                  rentalStart: null,
                  rentalEnd: null,
                  unitPriceCents: 25000,
                  totalCents: 25000,
                  providerName: null,
                  providerPhone: null,
                  deliveredAt: new Date(),
                },
              ],
            },
          ],
        },
      ],
    });

    const data = await buildHotelCalendarData("h1", { months: 1, includeGuestDetails: true });
    const args = prismaMock.hotel.findUnique.mock.calls[0][0];
    expect(args.include.listings.include.guestMetas).toEqual({ where: { canceledAt: null } });
    const span = data!.rooms[0].spans.find((s) => s.bookingId === "bk1");
    expect(span?.addons).toEqual([
      {
        id: "ba1",
        name: "Renta de vehículo",
        unit: "day",
        quantity: 2,
        option: "Scooter",
        rentalStart: toDateKey(start),
        rentalEnd: toDateKey(addDays(start, 1)),
        providerName: "Motos Zicatela",
        providerPhone: "+52 954 000 0000",
        delivered: false,
      },
      expect.objectContaining({ id: "ba2", delivered: true }),
    ]);
    expect(JSON.stringify(span?.addons)).not.toMatch(/Cents/);
  });
});
