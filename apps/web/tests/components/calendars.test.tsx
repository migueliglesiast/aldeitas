import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CalendarForm from "@/components/CalendarForm";
import CalendarSourceItem from "@/components/CalendarSourceItem";

function textbox(index: number) {
  return document.querySelectorAll<HTMLInputElement>("form input")[index];
}

const LISTINGS = [{ id: "l1", title: "Suite Mar", hotel: { name: "Hotel Uno" } }];

function jsonOk(body: unknown) {
  return { ok: true, json: async () => body };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("location", { reload: vi.fn() } as unknown as Location);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CalendarForm", () => {
  it("submits an allowlisted calendar and reloads", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url === "/api/listings" ? jsonOk(LISTINGS) : jsonOk({ id: "c1" })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<CalendarForm />);
    await screen.findByRole("option", { name: "Hotel Uno - Suite Mar" });

    await userEvent.type(textbox(0), "Guesty Room 1");
    await userEvent.type(textbox(1), "https://api.guesty.com/c.ics");
    await userEvent.selectOptions(screen.getByRole("combobox"), "l1");
    await userEvent.click(screen.getByRole("button", { name: "Add Calendar" }));

    await waitFor(() => expect(screen.getByText("Added")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/calendars",
      expect.objectContaining({
        body: JSON.stringify({
          name: "Guesty Room 1",
          icalUrl: "https://api.guesty.com/c.ics",
          listingId: "l1",
        }),
      })
    );
    expect(window.location.reload).toHaveBeenCalled();
  });

  it("shows the API error when the calendar is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/listings"
          ? jsonOk(LISTINGS)
          : { ok: false, json: async () => ({ error: "Invalid" }) }
      )
    );

    render(<CalendarForm />);
    await userEvent.type(textbox(0), "Internal");
    await userEvent.type(textbox(1), "https://169.254.169.254/x.ics");
    await userEvent.click(screen.getByRole("button", { name: "Add Calendar" }));

    await waitFor(() => expect(screen.getByText("Invalid")).toBeInTheDocument());
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("falls back to the response text and survives a failed listings fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/listings") throw new Error("offline");
        return {
          ok: false,
          json: async () => {
            throw new Error("not json");
          },
          text: async () => "Bad gateway",
        };
      })
    );

    render(<CalendarForm />);
    await userEvent.type(textbox(0), "Guesty");
    await userEvent.type(textbox(1), "https://api.guesty.com/c.ics");
    await userEvent.click(screen.getByRole("button", { name: "Add Calendar" }));

    await waitFor(() => expect(screen.getByText("Bad gateway")).toBeInTheDocument());
    expect(screen.queryByRole("option", { name: /Hotel Uno/ })).toBeNull();
  });
});

const SOURCE = {
  id: "c1",
  name: "Guesty Room 1",
  icalUrl: "https://api.guesty.com/c.ics",
  listingId: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  listing: null,
};

describe("CalendarSourceItem", () => {
  it("warns when the source is not linked and links it on demand", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn(async (url: string) =>
      url === "/api/listings" ? jsonOk(LISTINGS) : jsonOk({ id: "c1" })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<CalendarSourceItem source={SOURCE} />);
    expect(screen.getByText(/Not linked to any listing/)).toBeInTheDocument();

    const select = await screen.findByRole("combobox");
    expect(screen.getByRole("button", { name: "Update Link" })).toBeDisabled();
    await screen.findByRole("option", { name: "Hotel Uno - Suite Mar" });
    await userEvent.selectOptions(select, "l1");
    await userEvent.click(screen.getByRole("button", { name: "Update Link" }));

    await waitFor(() => expect(screen.getByText("Updated successfully")).toBeInTheDocument());
    await vi.advanceTimersByTimeAsync(1000);
    expect(window.location.reload).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("renders the linked listing and reports update failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/listings"
          ? jsonOk(LISTINGS)
          : { ok: false, json: async () => ({ error: "Failed to update" }) }
      )
    );

    render(
      <CalendarSourceItem
        source={{
          ...SOURCE,
          listingId: "l1",
          createdAt: new Date("2025-01-01"),
          listing: { id: "l1", title: "Suite Mar", hotel: { name: "Hotel Uno" } },
        }}
      />
    );

    expect(screen.getByText(/Hotel Uno - Suite Mar/)).toBeInTheDocument();
    await userEvent.selectOptions(await screen.findByRole("combobox"), "");
    await userEvent.click(screen.getByRole("button", { name: "Update Link" }));

    await waitFor(() => expect(screen.getByText("Failed to update")).toBeInTheDocument());
  });
});
