import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SignInPage from "@/app/sign-in/page";
import SignUpPage from "@/app/sign-up/page";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("location", { href: "" } as unknown as Location);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sign-in page", () => {
  it("redirects home after a successful sign in", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<SignInPage />);
    await userEvent.type(screen.getByPlaceholderText("Email or username"), "owner");
    await userEvent.type(screen.getByPlaceholderText("Password"), "secret1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(window.location.href).toBe("/"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/sign-in",
      expect.objectContaining({
        body: JSON.stringify({ email_or_username: "owner", password: "secret1" }),
      })
    );
  });

  it("shows the API error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Invalid credentials" }) })
    );

    render(<SignInPage />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });

  it("falls back to the response text for non-JSON errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error("not json");
        },
        text: async () => "",
      })
    );

    render(<SignInPage />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Failed to sign in")).toBeInTheDocument();
  });
});

describe("sign-up wizard", () => {
  it("walks through account, rooms, details and submits the hotel", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<SignUpPage />);

    await userEvent.type(screen.getByPlaceholderText("Username"), "owner");
    await userEvent.type(screen.getByPlaceholderText("Email"), "owner@example.com");
    await userEvent.type(screen.getByPlaceholderText("Password"), "secret1");
    await userEvent.type(screen.getByPlaceholderText("Name of hotel"), "Aldeita");
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    const rooms = screen.getByRole("spinbutton");
    await userEvent.clear(rooms);
    await userEvent.type(rooms, "1");
    await userEvent.click(screen.getByRole("button", { name: "Set rooms" }));
    expect(screen.getByText("You will describe 1 room(s) next.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.type(screen.getByPlaceholderText("Name of unit"), "Suite Mar");
    await userEvent.type(
      screen.getByPlaceholderText("Calendar iCal URL (optional)"),
      "https://www.airbnb.com/calendar/ical/1.ics"
    );
    await userEvent.type(screen.getByPlaceholderText("Unit description"), "Sea view");

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.type(screen.getByPlaceholderText("Phone number"), "5215551234");

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(window.location.href).toBe("/"));
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload).toMatchObject({
      username: "owner",
      hotel_name: "Aldeita",
      phone_number: "5215551234",
      units: [expect.objectContaining({ name_of_unit: "Suite Mar", cost_night: 100 })],
    });
  });

  it("navigates backwards and clamps at the first slide", async () => {
    render(<SignUpPage />);

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
  });

  it("shows the API error when sign up fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "User exists" }) })
    );

    render(<SignUpPage />);
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    await userEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect(await screen.findByText("User exists")).toBeInTheDocument();
  });
});
