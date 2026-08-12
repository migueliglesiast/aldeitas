import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SearchForm from "@/components/SearchForm";
import { HotelProvider } from "@/lib/hotel-context";

function renderForm() {
  return render(
    <HotelProvider>
      <SearchForm />
    </HotelProvider>
  );
}

function dateInputs() {
  return document.querySelectorAll<HTMLInputElement>('input[type="date"]');
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("SearchForm", () => {
  it("disables search until both dates are set", async () => {
    renderForm();
    const submit = screen.getByRole("button", { name: /search/i });
    expect(submit).toBeDisabled();

    const [checkIn, checkOut] = dateInputs();
    await userEvent.type(checkIn, "2030-01-01");
    expect(submit).toBeDisabled();
    await userEvent.type(checkOut, "2030-01-05");

    expect(submit).toBeEnabled();
    expect(screen.getByText("Jan 1")).toBeInTheDocument();
    expect(screen.getByText("Jan 5")).toBeInTheDocument();
  });

  it("clears the checkout date when it is not after the new check-in", async () => {
    renderForm();
    const [checkIn, checkOut] = dateInputs();

    await userEvent.type(checkIn, "2030-01-01");
    await userEvent.type(checkOut, "2030-01-05");
    await userEvent.clear(checkIn);
    await userEvent.type(checkIn, "2030-01-10");

    expect(checkOut.value).toBe("");
    expect(screen.getAllByText("Add date")).toHaveLength(1);
  });

  it("posts the date range and stores the availability response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ h1: 2 }) });
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    const [checkIn, checkOut] = dateInputs();

    await userEvent.type(checkIn, "2030-01-01");
    await userEvent.type(checkOut, "2030-01-05");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/search/availability",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ checkIn: "2030-01-01", checkOut: "2030-01-05" }),
        })
      )
    );
  });

  it("recovers from a failed availability request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    renderForm();
    const [checkIn, checkOut] = dateInputs();

    await userEvent.type(checkIn, "2030-01-01");
    await userEvent.type(checkOut, "2030-01-05");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /search/i })).toBeEnabled()
    );
  });

  it("adjusts guests and pets through the pickers and closes them on outside click", async () => {
    renderForm();

    await userEvent.click(screen.getByRole("button", { name: /1 guest/i }));
    const [decGuests, incGuests] = screen.getAllByRole("button", { name: "" });
    expect(decGuests).toBeDisabled();
    await userEvent.click(incGuests);
    expect(screen.getByRole("button", { name: /2 guests/i })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Done" })[0]);

    await userEvent.click(screen.getByRole("button", { name: /no pets/i }));
    const petButtons = screen.getAllByRole("button", { name: "" });
    await userEvent.click(petButtons[1]);
    expect(screen.getByRole("button", { name: /1 pet/i })).toBeInTheDocument();

    await userEvent.click(document.body);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Done" })).toBeNull());
  });
});
