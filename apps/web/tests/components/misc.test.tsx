import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AuthButton from "@/components/AuthButton";
import ContentContainer from "@/components/ContentContainer";
import HotelBlurOverlay from "@/components/HotelBlurOverlay";
import ListingGrid from "@/components/ListingGrid";
import ParallaxBackground from "@/components/ParallaxBackground";
import { HotelProvider, useHotel } from "@/lib/hotel-context";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

function jsonResponse(body: unknown) {
  return {
    ok: true,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("AuthButton", () => {
  it("shows sign-in links for anonymous visitors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ user: null })));

    render(<AuthButton />);

    expect(await screen.findByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign up" })).toBeInTheDocument();
  });

  it("greets the signed-in user and signs them out", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload } as unknown as Location);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ user: { username: "owner" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthButton />);

    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(screen.getByText("Hi, owner")).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-out", { method: "POST" })
    );
    expect(reload).toHaveBeenCalled();
  });

  it.each([
    ["a failed response", { ok: false, headers: new Headers(), json: async () => ({}) }],
    ["a non-JSON response", { ok: true, headers: new Headers(), json: async () => ({}) }],
    [
      "an unparseable body",
      {
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => {
          throw new Error("bad json");
        },
      },
    ],
  ])("treats %s as signed out", async (_label, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    render(<AuthButton />);

    expect(await screen.findByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("treats a network failure as signed out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<AuthButton />);

    expect(await screen.findByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });
});

const HOTELS = [
  {
    id: "h1",
    name: "Hotel Uno",
    description: "d",
    location: "Tulum",
    listings: [
      {
        id: "l1",
        title: "Suite Mar",
        nightlyBasePrice: 10000,
        baseCurrency: "USD",
        images: [{ id: "i1", url: "/a.jpg", position: 0 }],
      },
      { id: "l2", title: "Suite Sol", nightlyBasePrice: 30000, baseCurrency: "USD", images: [] },
    ],
  },
];

describe("ListingGrid", () => {
  it("renders listings with images or a placeholder", () => {
    render(<ListingGrid hotels={HOTELS} />);

    expect(screen.getByAltText("Suite Mar")).toBeInTheDocument();
    expect(screen.getByText("No image yet")).toBeInTheDocument();
    expect(screen.getByText("from $100 USD")).toBeInTheDocument();
  });

  it("filters by free text and by price range", async () => {
    render(<ListingGrid hotels={HOTELS} />);

    await userEvent.type(screen.getByPlaceholderText("Search location or title"), "sol");
    expect(screen.queryByText("Suite Mar")).toBeNull();
    expect(screen.getByText("Suite Sol")).toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText("Search location or title"));
    await userEvent.type(screen.getByPlaceholderText("Min $/night"), "150");
    expect(screen.queryByText("Suite Mar")).toBeNull();

    await userEvent.type(screen.getByPlaceholderText("Max $/night"), "200");
    expect(screen.getByText("No results. Adjust filters.")).toBeInTheDocument();
  });
});

function SelectImage({ url }: { url: string | null }) {
  const { setSelectedHotelImage } = useHotel();
  return (
    <button onClick={() => setSelectedHotelImage(url)}>select</button>
  );
}

class ImageStub {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = "";
  static shouldFail = false;
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => (ImageStub.shouldFail ? this.onerror?.() : this.onload?.()));
  }
  get src() {
    return this._src;
  }
}

describe("blurred hotel background", () => {
  beforeEach(() => {
    ImageStub.shouldFail = false;
    vi.stubGlobal("Image", ImageStub);
  });

  it("ContentContainer paints the selected image once it loads", async () => {
    render(
      <HotelProvider>
        <SelectImage url="/images/hotels/uno/cover.jpg" />
        <ContentContainer>
          <p>content</p>
        </ContentContainer>
      </HotelProvider>
    );

    expect(screen.getByText("content")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "select" }));

    await waitFor(() =>
      expect(
        document.querySelector('[style*="images/hotels/uno/cover.jpg"]')
      ).toBeInTheDocument()
    );
  });

  it("HotelBlurOverlay renders nothing without a selected image and stays hidden on error", async () => {
    ImageStub.shouldFail = true;
    const { container } = render(
      <HotelProvider>
        <SelectImage url="/broken.jpg" />
        <HotelBlurOverlay />
      </HotelProvider>
    );

    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "select" }));

    const overlay = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    await waitFor(() => expect(overlay.style.opacity).toBe("0"));
  });
});

describe("ParallaxBackground", () => {
  it("translates with the scroll position", async () => {
    const { container } = render(<ParallaxBackground />);
    const layer = container.firstElementChild as HTMLElement;

    expect(layer.style.transform).toBe("translateY(0px)");

    Object.defineProperty(window, "scrollY", { value: 100, configurable: true });
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(layer.style.transform).toBe("translateY(-30px)");
  });
});

describe("useHotel", () => {
  it("throws when used outside of the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const Orphan = () => {
      useHotel();
      return null;
    };

    expect(() => render(<Orphan />)).toThrow(/must be used within a HotelProvider/);
  });
});
