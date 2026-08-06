import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import BookingForm from "@/components/BookingForm";
import { HotelProvider } from "@/lib/hotel-context";

function renderForm() {
  return render(
    <HotelProvider>
      <BookingForm listingId="l1" basePriceCents={10000} currency="USD" />
    </HotelProvider>
  );
}

async function fillForm() {
  const [checkIn, checkOut] = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
  await userEvent.type(checkIn, "2030-01-01");
  await userEvent.type(checkOut, "2030-01-03");
  await userEvent.type(
    document.querySelector<HTMLInputElement>('input[type="email"]')!,
    "guest@example.com"
  );
  await userEvent.type(
    document.querySelector<HTMLInputElement>('input[type="tel"]')!,
    "5215551234"
  );
}

const PRICING = {
  nights: 2,
  nightlyCents: 9000,
  totalCents: 18000,
  currency: "MXN",
  basePriceCents: 10000,
  baseCurrency: "USD",
  isDynamic: true,
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("BookingForm", () => {
  it("keeps checkout disabled until a check-in is chosen and shows the base total", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    renderForm();
    const [checkIn, checkOut] = document.querySelectorAll<HTMLInputElement>('input[type="date"]');

    expect(checkOut).toBeDisabled();
    await userEvent.type(checkIn, "2030-01-01");
    expect(checkOut).toBeEnabled();
    await userEvent.type(checkOut, "2030-01-03");

    await waitFor(() => expect(screen.getByText("2 nights")).toBeInTheDocument());
  });

  it("shows dynamic pricing returned by the API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => PRICING }));
    renderForm();
    await fillForm();

    await waitFor(() => expect(screen.getByText("$180.00 MXN")).toBeInTheDocument());
    expect(screen.getByText(/Base rate: \$100.00/)).toBeInTheDocument();
  });

  it("clears pricing when the API reports an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: "nope" }) })
    );
    renderForm();
    await fillForm();

    await waitFor(() => expect(screen.getByText("$200.00 USD")).toBeInTheDocument());
  });

  it("redirects to Stripe checkout when the booking returns a checkout url", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.startsWith("/api/book")
        ? { ok: true, json: async () => ({ checkoutUrl: "https://checkout.stripe.com/s/1" }) }
        : { ok: true, json: async () => PRICING }
    );
    vi.stubGlobal("fetch", fetchMock);
    const location = { href: "" };
    vi.stubGlobal("location", location as unknown as Location);

    renderForm();
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));

    await waitFor(() => expect(location.href).toBe("https://checkout.stripe.com/s/1"));
  });

  it("confirms a booking created without payment", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.startsWith("/api/book")
        ? { ok: true, json: async () => ({ bookingId: "b1" }) }
        : { ok: true, json: async () => PRICING }
    );
    vi.stubGlobal("fetch", fetchMock);

    renderForm();
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));

    await waitFor(() => expect(screen.getByText("Booking created.")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/book",
      expect.objectContaining({
        body: JSON.stringify({
          listingId: "l1",
          start: "2030-01-01",
          end: "2030-01-03",
          email: "guest@example.com",
          phone: "5215551234",
        }),
      })
    );
  });

  it("surfaces a 409 conflict returned by the booking API", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.startsWith("/api/book")
        ? { ok: false, status: 409, json: async () => ({ error: "Dates unavailable" }) }
        : { ok: true, json: async () => PRICING }
    );
    vi.stubGlobal("fetch", fetchMock);

    renderForm();
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));

    await waitFor(() => expect(screen.getByText("Dates unavailable")).toBeInTheDocument());
  });

  it("falls back to the response text when the booking response is not JSON", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.startsWith("/api/book")
        ? {
            ok: false,
            json: async () => {
              throw new Error("not json");
            },
            text: async () => "Gateway timeout",
          }
        : { ok: true, json: async () => PRICING }
    );
    vi.stubGlobal("fetch", fetchMock);

    renderForm();
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));

    await waitFor(() => expect(screen.getByText("Gateway timeout")).toBeInTheDocument());
  });

  it("clears the checkout date when the new check-in is not earlier", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => PRICING }));
    renderForm();
    const [checkIn, checkOut] = document.querySelectorAll<HTMLInputElement>('input[type="date"]');

    await userEvent.type(checkIn, "2030-01-01");
    await userEvent.type(checkOut, "2030-01-03");
    await userEvent.clear(checkIn);
    await userEvent.type(checkIn, "2030-01-05");

    await waitFor(() => expect(checkOut.value).toBe(""));
    expect(screen.getByText("0 nights")).toBeInTheDocument();
  });
});
