import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import "jest-axe/extend-expect";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SignInPage from "@/app/sign-in/page";
import SignUpPage from "@/app/sign-up/page";
import BookingForm from "@/components/BookingForm";
import SearchForm from "@/components/SearchForm";
import { HotelProvider } from "@/lib/hotel-context";

// These tests target rendered output through axe's semantic checks (roles,
// labels, contrast-independent rules) rather than specific markup, so they
// stay valid while the UI components are redesigned.

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function expectNoViolations(ui: React.ReactElement) {
  const { container } = render(ui);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

describe("accessibility (axe)", () => {
  it("sign-in page has no axe violations", async () => {
    await expectNoViolations(<SignInPage />);
  });

  it("sign-up page has no axe violations", async () => {
    await expectNoViolations(<SignUpPage />);
  });

  it("search form has no axe violations", async () => {
    await expectNoViolations(
      <HotelProvider>
        <SearchForm />
      </HotelProvider>
    );
  });

  it("booking form has no axe violations", async () => {
    await expectNoViolations(
      <HotelProvider>
        <BookingForm listingId="l1" basePriceCents={10000} currency="USD" />
      </HotelProvider>
    );
  });
});
