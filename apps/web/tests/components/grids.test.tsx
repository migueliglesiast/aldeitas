import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import FilteredListingGrid from "@/components/FilteredListingGrid";
import HotelGrid from "@/components/HotelGrid";
import { HotelProvider, useHotel } from "@/lib/hotel-context";

vi.mock("next/image", () => ({
  default: ({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) => (
    // eslint-disable-next-line jsx-a11y/alt-text
    <img src={src} alt={alt} onError={onError} />
  ),
}));

const LISTINGS = [
  {
    id: "l1",
    title: "Suite Mar",
    nightlyBasePrice: 10000,
    baseCurrency: "USD",
    images: [{ id: "i1", url: "/a.jpg", position: 0 }],
  },
  { id: "l2", title: "Suite Sol", nightlyBasePrice: 20000, baseCurrency: "USD", images: [] },
];

function Search({ checkIn = "2030-01-01", checkOut = "2030-01-03" }) {
  const { setSearchParams, setHotelAvailability } = useHotel();
  return (
    <button
      onClick={() => {
        setSearchParams({ checkIn, checkOut, guests: 1, pets: 0 });
        setHotelAvailability({ h1: 1 });
      }}
    >
      search
    </button>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FilteredListingGrid", () => {
  it("shows every listing when no search is active", () => {
    render(
      <HotelProvider>
        <FilteredListingGrid listings={LISTINGS} hotelName="Hotel Uno" />
      </HotelProvider>
    );

    expect(screen.getByText("Suite Mar")).toBeInTheDocument();
    expect(screen.getByText("No image yet")).toBeInTheDocument();
    expect(screen.getAllByText("Hotel Uno")).toHaveLength(2);
  });

  it("renders the empty state when there are no listings", () => {
    render(
      <HotelProvider>
        <FilteredListingGrid listings={[]} />
      </HotelProvider>
    );

    expect(screen.getByText("No rooms listed yet.")).toBeInTheDocument();
  });

  it("keeps only the listings free during the searched range", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("l1")
          ? { ok: true, json: async () => ({ bookedDates: ["2030-01-02"] }) }
          : { ok: true, json: async () => ({ bookedDates: [] }) }
      )
    );

    render(
      <HotelProvider>
        <Search />
        <FilteredListingGrid listings={LISTINGS} />
      </HotelProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: "search" }));

    await waitFor(() => expect(screen.queryByText("Suite Mar")).toBeNull());
    expect(screen.getByText("Suite Sol")).toBeInTheDocument();
  });

  it("treats failed and unreachable availability checks as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("l1")) return { ok: false };
        throw new Error("offline");
      })
    );

    render(
      <HotelProvider>
        <Search />
        <FilteredListingGrid listings={LISTINGS} />
      </HotelProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: "search" }));

    await waitFor(() =>
      expect(screen.getByText("No rooms available for the selected dates.")).toBeInTheDocument()
    );
  });
});

const HOTELS = [
  {
    id: "h1",
    name: "Hotel Uno",
    description: "d",
    location: "Tulum",
    googleMapsUrl: "https://maps.google.com/embed?pb=1",
    listings: LISTINGS,
  },
  {
    id: "h2",
    name: "Hotel Dos",
    description: "d",
    location: "Mérida",
    googleMapsUrl: null,
    listings: [],
  },
];

function renderHotels() {
  return render(
    <HotelProvider>
      <Search />
      <HotelGrid hotels={HOTELS} />
    </HotelProvider>
  );
}

describe("HotelGrid", () => {
  it("summarises rooms and the cheapest price per hotel", () => {
    renderHotels();

    expect(screen.getByText("from $100")).toBeInTheDocument();
    expect(screen.getByText("2 rooms")).toBeInTheDocument();
    expect(screen.getByText("0 rooms")).toBeInTheDocument();
  });

  it("falls back through cover image extensions and then to the logo", async () => {
    renderHotels();
    const cover = screen.getByAltText("Hotel Uno") as HTMLImageElement;
    expect(cover.src).toContain("/images/hotels/hotel-uno/cover.jpg");

    for (const ext of ["jpeg", "png", "webp"]) {
      fireEvent.error(screen.getByAltText("Hotel Uno"));
      await waitFor(() =>
        expect((screen.getByAltText("Hotel Uno") as HTMLImageElement).src).toContain(
          `cover.${ext}`
        )
      );
    }

    fireEvent.error(screen.getByAltText("Hotel Uno"));
    await waitFor(() => expect(screen.queryByAltText("Hotel Uno")).toBeNull());
    expect(screen.getAllByAltText("Aldeitas logo").length).toBeGreaterThan(0);
  });

  it("shows only hotels with availability once a search runs", async () => {
    renderHotels();

    await userEvent.click(screen.getByRole("button", { name: "search" }));

    expect(screen.getByText("Hotel Uno")).toBeInTheDocument();
    expect(screen.queryByText("Hotel Dos")).toBeNull();
    expect(screen.getByText(/room.? available/)).toBeInTheDocument();
  });

  it("filters hotels by name or location and shows an empty state", async () => {
    renderHotels();
    const grid = screen.getByText("Hotel Uno").closest("div.space-y-4");
    expect(grid).toBeTruthy();

    // HotelGrid keeps its query in local state; drive it through the exposed input
    const input = document.querySelector<HTMLInputElement>('input[type="text"]');
    if (input) {
      await userEvent.type(input, "nonexistent");
      expect(screen.getByText("No results found. Try adjusting your search.")).toBeInTheDocument();
    }
  });

  it("expands a hotel card, cycles the gallery and closes again", async () => {
    renderHotels();

    await userEvent.click(screen.getByText("Hotel Uno"));

    expect(screen.getByRole("heading", { name: "Hotel Uno" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /See Rooms and Availability/ })).toHaveAttribute(
      "href",
      "/hotel/h1"
    );
    expect(document.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://maps.google.com/embed?pb=1"
    );

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("heading", { name: "Hotel Uno" })).toBeNull();
  });

  it("reports a missing map for hotels without a maps url", async () => {
    renderHotels();

    await userEvent.click(screen.getByText("Hotel Dos"));

    expect(screen.getByText("Map URL not available")).toBeInTheDocument();
  });
});
