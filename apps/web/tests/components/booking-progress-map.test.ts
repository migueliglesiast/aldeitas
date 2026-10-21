import { describe, expect, it } from "vitest";
import { buildProgressSteps } from "@/components/BookingProgressMap";

const base = {
  id: "b1",
  status: "PENDING" as const,
  guestEmail: "guest@example.com",
  guestName: null,
  startDate: "2026-10-27T00:00:00.000Z",
  endDate: "2026-10-30T00:00:00.000Z",
  totalPriceCents: 256500,
  currency: "MXN",
  paymentOrderId: null,
  createdAt: "2026-10-21T20:00:00.000Z",
  authorizedAt: null,
  confirmedAt: null,
  pendingExpiresAt: null,
  lastReconciledAt: null,
  cancelReason: null,
  listing: { title: "Forest Studio 3", hotelName: "La Arbolita" },
  addons: [],
};

const event = (step: string, status = "ok", detail: string | null = null) => ({
  step,
  status,
  detail,
  createdAt: "2026-10-21T20:01:00.000Z",
});

const stateOf = (steps: ReturnType<typeof buildProgressSteps>) =>
  Object.fromEntries(steps.map((step) => [step.key, step.state]));

describe("buildProgressSteps", () => {
  it("waits on the guest's card right after booking", () => {
    const states = stateOf(buildProgressSteps(base, [event("created"), event("availability_initial")]));
    expect(states).toMatchObject({
      created: "done",
      availability_initial: "done",
      payment: "waiting",
      availability_check: "waiting",
      outcome: "waiting",
    });
  });

  it("shows a credit-card hold in progress until the capture", () => {
    const states = stateOf(
      buildProgressSteps({ ...base, authorizedAt: "2026-10-21T20:02:00.000Z" }, [
        event("created"),
        event("payment_submitted", "info"),
        event("payment_held"),
        event("availability_check"),
        event("dates_blocked"),
        event("email_processing"),
      ])
    );
    expect(states).toMatchObject({
      payment: "done",
      availability_check: "done",
      dates_blocked: "done",
      email_processing: "done",
      payment_final: "active",
      outcome: "active",
      email_final: "waiting",
    });
  });

  it("skips the processing email for debit cards charged at once", () => {
    const steps = buildProgressSteps(
      { ...base, status: "CONFIRMED", authorizedAt: "2026-10-21T20:02:00.000Z", confirmedAt: "2026-10-21T20:02:01.000Z" },
      [event("payment_charged"), event("availability_check"), event("payment_captured"), event("confirmed"), event("email_confirmed")]
    );
    expect(steps.map((step) => step.key)).not.toContain("email_processing");
    expect(stateOf(steps)).toMatchObject({ payment: "done", payment_final: "done", outcome: "done", email_final: "done" });
  });

  it("flags a failed email and a declined card", () => {
    const states = stateOf(
      buildProgressSteps(base, [event("payment_submitted", "info"), event("payment_failed", "fail", "Fondos insuficientes")])
    );
    expect(states.payment).toBe("active");

    const confirmed = stateOf(
      buildProgressSteps({ ...base, status: "CONFIRMED", authorizedAt: base.createdAt, confirmedAt: base.createdAt }, [
        event("payment_held"),
        event("email_confirmed", "fail", "email not configured"),
      ])
    );
    expect(confirmed.email_final).toBe("failed");
  });

  it("shows a released hold when another site took the dates", () => {
    const states = stateOf(
      buildProgressSteps(
        { ...base, status: "CANCELED", authorizedAt: base.createdAt, cancelReason: "Booked on another site" },
        [event("payment_held"), event("availability_check", "fail"), event("payment_released"), event("canceled", "fail")]
      )
    );
    expect(states).toMatchObject({ availability_check: "failed", payment_final: "done", outcome: "failed" });
  });
});
