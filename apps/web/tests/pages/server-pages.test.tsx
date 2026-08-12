import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const dataMock = {
  getHotelsWithListings: vi.fn(),
  getHotelDetail: vi.fn(),
  getListingDetail: vi.fn(),
};
const prismaMock = {
  listing: { findMany: vi.fn() },
  calendarSource: { findMany: vi.fn() },
};

vi.mock("@/lib/data", () => dataMock);
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/components/HotelGrid", () => ({
  default: ({ hotels }: { hotels: { id: string }[] }) => (
    <div data-testid="hotel-grid">{hotels.map((h) => h.id).join(",")}</div>
  ),
}));
vi.mock("@/components/SearchForm", () => ({ default: () => <div>search-form</div> }));
vi.mock("@/components/FilteredListingGrid", () => ({
  default: ({ listings }: { listings: { id: string }[] }) => (
    <div data-testid="listing-grid">{listings.map((l) => l.id).join(",")}</div>
  ),
}));
vi.mock("@/components/BookingForm", () => ({ default: () => <div>booking-form</div> }));
vi.mock("@/components/AvailabilityCalendar", () => ({ default: () => <div>calendar</div> }));
vi.mock("@/components/CalendarForm", () => ({ default: () => <div>calendar-form</div> }));
vi.mock("@/components/CalendarSourceItem", () => ({
  default: ({ source }: { source: { name: string } }) => <div>{source.name}</div>,
}));

const { default: HomePage } = await import("@/app/page");
const { default: HotelsIndexPage } = await import("@/app/hotel/page");
const { default: HotelPage } = await import("@/app/hotel/[id]/page");
const { default: ListingPage, generateStaticParams } = await import("@/app/listing/[id]/page");
const { default: CalendarsAdminPage } = await import("@/app/admin/calendars/page");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("home page", () => {
  it("orders the curated hotels first and keeps the rest at the end", async () => {
    dataMock.getHotelsWithListings.mockResolvedValue([
      { id: "other", name: "Zzz", listings: [] },
      { id: "casa", name: "Casa Yahua", listings: [] },
      { id: "mixteca", name: "Aldeita Mixteca", listings: [] },
    ]);

    render(await HomePage());

    expect(screen.getByTestId("hotel-grid")).toHaveTextContent("mixteca,casa,other");
    expect(screen.getByRole("link", { name: "Create your account" })).toHaveAttribute(
      "href",
      "/sign-up"
    );
  });
});

describe("hotels index page", () => {
  it("renders every hotel", async () => {
    dataMock.getHotelsWithListings.mockResolvedValue([{ id: "h1", name: "Hotel", listings: [] }]);

    render(await HotelsIndexPage());

    expect(screen.getByText("Browse Hotels")).toBeInTheDocument();
    expect(screen.getByTestId("hotel-grid")).toHaveTextContent("h1");
  });
});

describe("hotel detail page", () => {
  it("renders the not-found state", async () => {
    dataMock.getHotelDetail.mockResolvedValue(null);

    render(await HotelPage({ params: Promise.resolve({ id: "missing" }) }));

    expect(screen.getByText("Hotel not found")).toBeInTheDocument();
  });

  it("passes the serialized listings to the grid", async () => {
    dataMock.getHotelDetail.mockResolvedValue({
      name: "Hotel Uno",
      location: "Tulum",
      listings: [
        { id: "l1", title: "Suite", nightlyBasePrice: 100, baseCurrency: "USD", images: [] },
      ],
    });

    render(await HotelPage({ params: Promise.resolve({ id: "h1" }) }));

    expect(screen.getByRole("heading", { name: "Hotel Uno" })).toBeInTheDocument();
    expect(screen.getByTestId("listing-grid")).toHaveTextContent("l1");
  });
});

describe("listing detail page", () => {
  it("renders the not-found state", async () => {
    dataMock.getListingDetail.mockResolvedValue(null);

    render(await ListingPage({ params: Promise.resolve({ id: "missing" }) }));

    expect(screen.getByText("Listing not found")).toBeInTheDocument();
  });

  it("renders images, description, booking form and calendar", async () => {
    dataMock.getListingDetail.mockResolvedValue({
      id: "l1",
      title: "Suite Mar",
      description: "Sea view",
      nightlyBasePrice: 10000,
      baseCurrency: "USD",
      images: [{ id: "i1", url: "/a.jpg" }],
      hotel: { location: "Tulum" },
    });

    render(await ListingPage({ params: Promise.resolve({ id: "l1" }) }));

    expect(screen.getByAltText("Suite Mar")).toBeInTheDocument();
    expect(screen.getByText("Sea view")).toBeInTheDocument();
    expect(screen.getByText("booking-form")).toBeInTheDocument();
    expect(screen.getByText("calendar")).toBeInTheDocument();
  });

  it("falls back to a placeholder when there are no images", async () => {
    dataMock.getListingDetail.mockResolvedValue({
      id: "l1",
      title: "Suite Mar",
      description: null,
      nightlyBasePrice: 10000,
      baseCurrency: "USD",
      images: [],
      hotel: { location: "Tulum" },
    });

    render(await ListingPage({ params: Promise.resolve({ id: "l1" }) }));

    expect(screen.getByText("Images coming soon")).toBeInTheDocument();
  });

  it("pre-generates listing params and tolerates a missing database", async () => {
    prismaMock.listing.findMany.mockResolvedValueOnce([{ id: "l1" }]);
    await expect(generateStaticParams()).resolves.toEqual([{ id: "l1" }]);

    prismaMock.listing.findMany.mockRejectedValueOnce(new Error("no db"));
    await expect(generateStaticParams()).resolves.toEqual([]);
  });
});

describe("calendars admin page", () => {
  it("renders the empty state and the existing sources", async () => {
    prismaMock.calendarSource.findMany.mockResolvedValueOnce([]);
    const { unmount } = render(await CalendarsAdminPage());
    expect(screen.getByText(/No calendar sources yet/)).toBeInTheDocument();
    unmount();

    prismaMock.calendarSource.findMany.mockResolvedValueOnce([{ id: "c1", name: "Guesty" }]);
    render(await CalendarsAdminPage());
    expect(screen.getByText("Guesty")).toBeInTheDocument();
  });
});
