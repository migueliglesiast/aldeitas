import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ImageCarousel from "@/components/ImageCarousel";
import HotelGrid from "@/components/HotelGrid";
import { HotelProvider } from "@/lib/hotel-context";

vi.mock("next/image", () => ({
  default: ({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={onError} />
  ),
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ImageCarousel", () => {
  it("renders nothing when there are no images", () => {
    const { container } = render(<ImageCarousel images={[]} alt="empty" />);
    expect(container.firstChild).toBeNull();
  });

  it("shows a single image without navigation arrows", () => {
    render(<ImageCarousel images={["/one.jpg"]} alt="solo" />);
    expect(screen.getByAltText("solo")).toBeInTheDocument();
    expect(screen.queryByLabelText("Next photo")).toBeNull();
    expect(screen.queryByLabelText("Previous photo")).toBeNull();
  });

  it("cycles forwards and backwards through multiple images", async () => {
    render(<ImageCarousel images={["/a.jpg", "/b.jpg", "/c.jpg"]} alt="multi" />);
    const img = () => screen.getByAltText("multi") as HTMLImageElement;
    expect(img().src).toContain("/a.jpg");

    await userEvent.click(screen.getByLabelText("Next photo"));
    expect(img().src).toContain("/b.jpg");

    await userEvent.click(screen.getByLabelText("Previous photo"));
    expect(img().src).toContain("/a.jpg");

    await userEvent.click(screen.getByLabelText("Previous photo"));
    expect(img().src).toContain("/c.jpg");
  });
});

const HOTELS = [
  {
    id: "h1",
    name: "Hotel Uno",
    description: "d",
    location: "Tulum",
    googleMapsUrl: "https://maps.google.com/embed?pb=1",
    listings: [
      {
        id: "l1",
        title: "Suite Mar",
        nightlyBasePrice: 10000,
        baseCurrency: "USD",
        images: [{ id: "i1", url: "/a.jpg", position: 0 }],
      },
    ],
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

describe("HotelGrid map view", () => {
  it("toggles the map view and lists only hotels with map locations", async () => {
    render(
      <HotelProvider>
        <HotelGrid hotels={HOTELS} />
      </HotelProvider>
    );

    const toggle = screen.getByRole("button", { name: /show map/i });
    await userEvent.click(toggle);

    expect(screen.getByTitle("Map of Hotel Uno")).toBeInTheDocument();
    expect(screen.getByText("from $100")).toBeInTheDocument();
    expect(screen.queryByText("Hotel Dos")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /hide map/i }));
    expect(screen.queryByTitle("Map of Hotel Uno")).toBeNull();
    expect(screen.getByText("Hotel Dos")).toBeInTheDocument();
  });

  it("selects a hotel from the map list", async () => {
    render(
      <HotelProvider>
        <HotelGrid hotels={HOTELS} />
      </HotelProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: /show map/i }));
    await userEvent.click(screen.getByRole("button", { name: /Hotel Uno/ }));
    expect(screen.getByTitle("Map of Hotel Uno")).toBeInTheDocument();
  });

  it("shows an empty state when no hotels have map locations", async () => {
    render(
      <HotelProvider>
        <HotelGrid hotels={[HOTELS[1]]} />
      </HotelProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: /show map/i }));
    expect(
      screen.getByText("No hotels with map locations match your filters.")
    ).toBeInTheDocument();
    expect(screen.getByText("Map unavailable")).toBeInTheDocument();
  });
});
