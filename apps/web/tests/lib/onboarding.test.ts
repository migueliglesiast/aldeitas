import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { parseCoordinates } from "@/lib/onboarding";

describe("parseCoordinates", () => {
  it("reads Google Maps place links", () => {
    expect(
      parseCoordinates("https://www.google.com/maps/place/La+Arbolita/@15.8486,-97.0599,17z/data=!3d15.8481!4d-97.0611")
    ).toEqual({ latitude: 15.8481, longitude: -97.0611 });
    expect(parseCoordinates("https://www.google.com/maps/@15.8486,-97.0599,17z")).toEqual({
      latitude: 15.8486,
      longitude: -97.0599,
    });
  });

  it("reads query links and plain coordinates", () => {
    expect(parseCoordinates("https://maps.google.com/?q=15.84,-97.05")).toEqual({ latitude: 15.84, longitude: -97.05 });
    expect(parseCoordinates(" 15.84, -97.05 ")).toEqual({ latitude: 15.84, longitude: -97.05 });
  });

  it("rejects text without coordinates", () => {
    expect(parseCoordinates("https://maps.app.goo.gl/abc123")).toBeNull();
    expect(parseCoordinates("Puerto Escondido")).toBeNull();
  });
});
