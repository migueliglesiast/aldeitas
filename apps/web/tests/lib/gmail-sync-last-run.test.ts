import { describe, expect, it } from "vitest";
import { lastRunComplete } from "@/lib/gmail-booking-sync";

describe("lastRunComplete", () => {
  it("narrows the search only after a clean run", () => {
    expect(lastRunComplete(null)).toBe(true);
    expect(lastRunComplete("2× cancellation: stay not found")).toBe(true);
    expect(lastRunComplete("No reservation emails matched rooms/dates.")).toBe(true);
    expect(lastRunComplete("Partial sync (time limit). 10× cancellation: stay not found")).toBe(false);
    expect(lastRunComplete("Invalid credentials (Failure)")).toBe(false);
  });
});
