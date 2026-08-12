import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import { HotelProvider, useHotel } from "@/lib/hotel-context";

const TODAY = new Date("2030-03-10T12:00:00Z");

function iso(day: number) {
  return `2030-03-${String(day).padStart(2, "0")}`;
}

function SearchParamsProbe() {
  const { searchParams } = useHotel();
  return <output data-testid="params">{JSON.stringify(searchParams)}</output>;
}

function renderCalendar(monthsToShow = 1) {
  return render(
    <HotelProvider>
      <AvailabilityCalendar listingId="l1" monthsToShow={monthsToShow} />
      <SearchParamsProbe />
    </HotelProvider>
  );
}

function march() {
  return screen.getByText("March 2030").parentElement as HTMLElement;
}

function day(n: number) {
  return within(march()).getByText(String(n));
}

function params() {
  return JSON.parse(screen.getByTestId("params").textContent || "null");
}

function mockAvailability(bookedDates: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bookedDates }) })
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: TODAY });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AvailabilityCalendar", () => {
  it("renders booked, today and past days with their state", async () => {
    mockAvailability([iso(20)]);
    renderCalendar();

    await waitFor(() => expect(screen.getByText("Availability")).toBeInTheDocument());
    expect(day(20)).toHaveAttribute("title", "Booked");
    expect(day(10)).toHaveAttribute("title", "Today");
    expect(day(1)).toHaveAttribute("title", "Past");
    expect(day(15)).toHaveAttribute("title", "Available");
  });

  it("shows an error message when availability cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    renderCalendar();

    expect(
      await screen.findByText("Unable to load availability calendar")
    ).toBeInTheDocument();
    expect(screen.getByText("Failed to fetch availability")).toBeInTheDocument();
  });

  it("selects a range on two clicks and publishes it to the context", async () => {
    mockAvailability([]);
    renderCalendar();
    await waitFor(() => expect(screen.getByText("Availability")).toBeInTheDocument());

    await userEvent.click(day(15));
    expect(params()).toEqual({ checkIn: iso(15), checkOut: "", guests: 1, pets: 0 });
    expect(day(15)).toHaveAttribute("title", "Check-in selected");
    expect(day(14)).toHaveAttribute("title", "Before check-in");

    await userEvent.click(day(18));
    expect(params()).toEqual({ checkIn: iso(15), checkOut: iso(18), guests: 1, pets: 0 });
    expect(day(16)).toHaveAttribute("title", "Selected");
    expect(screen.getByText("Selected")).toBeInTheDocument();
  });

  it("clears the selection when the check-in day is clicked again", async () => {
    mockAvailability([]);
    renderCalendar();
    await waitFor(() => expect(screen.getByText("Availability")).toBeInTheDocument());

    await userEvent.click(day(15));
    await userEvent.click(day(15));

    expect(params()).toBeNull();
    expect(day(15)).toHaveAttribute("title", "Available");
  });

  it("ignores booked and past days and blocks ranges that cross a booked day", async () => {
    mockAvailability([iso(17)]);
    renderCalendar();
    await waitFor(() => expect(screen.getByText("Availability")).toBeInTheDocument());

    await userEvent.click(day(1));
    await userEvent.click(day(17));
    expect(params()).toBeNull();

    await userEvent.click(day(15));
    expect(day(18)).toHaveAttribute("title", "Unavailable");
    await userEvent.click(day(18));
    expect(params()).toMatchObject({ checkIn: iso(15), checkOut: "" });
  });

  it("supports keyboard selection", async () => {
    mockAvailability([]);
    renderCalendar();
    await waitFor(() => expect(screen.getByText("Availability")).toBeInTheDocument());

    day(15).focus();
    await userEvent.keyboard("{Enter}");
    day(17).focus();
    await userEvent.keyboard(" ");

    expect(params()).toMatchObject({ checkIn: iso(15), checkOut: iso(17) });
  });

  it("marks a range that contains booked days as unavailable", async () => {
    mockAvailability([iso(17)]);
    render(
      <HotelProvider>
        <AvailabilityCalendar listingId="l1" monthsToShow={1} />
        <SearchParamsProbe />
        <SelectRange />
      </HotelProvider>
    );
    await waitFor(() => expect(screen.getByText("Availability")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "external" }));

    await waitFor(() => expect(day(17)).toHaveAttribute("title", "Booked (Selected Range)"));
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(day(16)).toHaveAttribute(
      "title",
      "Selected (Range contains unavailable dates)"
    );
  });
});

function SelectRange() {
  const { setSearchParams } = useHotel();
  return (
    <button
      onClick={() =>
        setSearchParams({ checkIn: iso(16), checkOut: iso(18), guests: 2, pets: 0 })
      }
    >
      external
    </button>
  );
}
