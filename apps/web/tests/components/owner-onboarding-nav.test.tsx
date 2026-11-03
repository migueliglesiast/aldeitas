import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import OwnerOnboarding from "@/components/onboarding/OwnerOnboarding";
import type { OnboardingState } from "@/lib/onboarding";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

const state: OnboardingState = {
  user: { nickname: "Clara", fullName: "Clara Torres", phoneNumber: "+525500000000" },
  hotel: {
    id: "h1",
    name: "Aldeita Mixteca",
    description: "Cabañas junto al mar",
    location: "Oaxaca",
    googleMapsUrl: "",
    latitude: 15.8,
    longitude: -97.1,
    gmailEmail: "",
    gmailConnected: false,
    mercadoPagoConnected: false,
    mercadoPagoAccount: "",
    payoutEmail: "",
    payoutClabe: "",
    payoutHolder: "",
    payoutRfc: "",
  },
  rooms: [],
  isOwner: false,
  owner: null,
  managers: [],
  cleaner: null,
  maintenance: null,
  publicCalendarUrl: null,
  ownerCalendarUrl: null,
  missing: ["team", "payouts"],
};

describe("OwnerOnboarding navbar missing-info menu", () => {
  beforeEach(() => {
    window.localStorage.setItem("aldeitas-onboarding-seen:u1", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(state), { status: 200, headers: { "Content-Type": "application/json" } }))
    );
  });

  it("lists each missing item and opens the slideshow on the one clicked", async () => {
    const user = userEvent.setup();
    render(<OwnerOnboarding userId="u1" />);

    const pill = await screen.findByRole("button", { name: /2 steps left/ });
    expect(pill).toHaveTextContent("2");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(pill);
    const items = screen.getAllByRole("menuitem").map((el) => el.textContent);
    expect(items).toEqual([
      expect.stringContaining("Cleaning contact"),
      expect.stringContaining("Bank account (CLABE and name)"),
      "Complete everything",
    ]);

    await user.click(screen.getByRole("menuitem", { name: /Bank account/ }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Where should we send your money?")).toBeInTheDocument());
  });

  it("recognizes the bank as soon as the CLABE's first digits are typed", async () => {
    const user = userEvent.setup();
    render(<OwnerOnboarding userId="u1" />);
    await user.click(await screen.findByRole("button", { name: /2 steps left/ }));
    await user.click(screen.getByRole("menuitem", { name: /Bank account/ }));
    const input = await screen.findByLabelText("CLABE (18 digits)");
    expect(screen.queryByRole("link", { name: /Mercado Pago/ })).not.toBeInTheDocument();

    await user.type(input, "012");
    const card = screen.getByTestId("clabe-bank");
    expect(card).toHaveTextContent("BBVA");
    expect(card.querySelector("img")).toHaveAttribute("src", "/banks/012.png");

    await user.type(input, "180012345678919");
    expect(input).toHaveValue("012 180 01234567891 9");
    expect(card).toHaveTextContent(/Valid CLABE|isn't valid/);

    await user.clear(input);
    await user.type(input, "999");
    expect(screen.getByTestId("clabe-bank")).toHaveTextContent("Bank not recognized");
  });

  it("closes the menu with Escape", async () => {
    const user = userEvent.setup();
    render(<OwnerOnboarding userId="u1" />);
    await user.click(await screen.findByRole("button", { name: /2 steps left/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
