import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HotelMultiCalendar from "@/components/HotelMultiCalendar";
import type { HotelCalendarPayload } from "@/lib/hotel-calendar-data";

const days = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];

function payload(): HotelCalendarPayload {
  const cells: HotelCalendarPayload["rooms"][number]["cells"] = {};
  for (const day of days) {
    cells[day] =
      day === "2026-11-10" || day === "2026-11-11"
        ? {
            status: "booking",
            priceCents: 0,
            priceOverride: false,
            bookingId: "bk1",
            bookingStatus: "CONFIRMED",
            guestName: "Ana",
            spanId: "booking-bk1",
          }
        : { status: "available", priceCents: 0, priceOverride: false };
  }
  return {
    hotel: { id: "h1", name: "Hotel", location: "Puerto" },
    startDate: days[0],
    endDate: days[3],
    days,
    readOnly: true,
    rooms: [
      {
        id: "l1",
        title: "Unit 7",
        nightlyBasePrice: 100000,
        baseCurrency: "MXN",
        cells,
        spans: [
          {
            id: "booking-bk1",
            kind: "booking",
            startDay: "2026-11-10",
            endDay: "2026-11-11",
            checkoutDay: "2026-11-12",
            rangeStartDay: "2026-11-10",
            dayCount: 2,
            label: "Confirmed",
            guestName: "Ana",
            bookingId: "bk1",
            bookingStatus: "CONFIRMED",
            source: "aldeitas",
            addons: [
              {
                id: "ba1",
                name: "Renta de vehículo",
                quantity: 2,
                unit: "day",
                option: "Scooter",
                rentalStart: "2026-11-10",
                rentalEnd: "2026-11-11",
                providerName: "Motos Zicatela",
                providerPhone: "+52 954 000 0000",
                delivered: false,
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("HotelMultiCalendar extras", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify({ id: "ba1", delivered: true }), { status: 200 });
      }
      return new Response(JSON.stringify(payload()), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
  });

  it("shows an extras badge the cleaner can open and tick off", async () => {
    render(<HotelMultiCalendar hotelId="h1" readOnly shareToken="tok" />);
    const badge = await screen.findByTestId("addon-badge");
    expect(badge.textContent).toBe("🎁1");

    fireEvent.click(badge);
    expect(await screen.findByText(/0\/\s*1 entregados/)).toBeTruthy();
    expect(screen.getByText(/Renta de vehículo · Scooter/)).toBeTruthy();
    expect(screen.getByText(/Motos Zicatela/)).toBeTruthy();
    expect(screen.queryByText(/\$|MX\$|500/)).toBeNull();

    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(screen.getByTestId("addon-badge").textContent).toBe("✓1"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/calendar/share/tok/addons",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ addonId: "ba1", delivered: true }),
      })
    );
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });
});
