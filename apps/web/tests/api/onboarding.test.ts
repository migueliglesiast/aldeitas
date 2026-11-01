// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const prismaMock = {
  user: { update: vi.fn() },
  hotel: { update: vi.fn() },
  hotelContact: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
};
const getCurrentUser = vi.fn();
const getPrimaryHotelId = vi.fn();
const getOnboardingState = vi.fn(async () => ({ ok: true }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/sync-bilingual-description", () => ({ syncBilingualDescription: vi.fn() }));
vi.mock("@/lib/onboarding", () => ({ getOnboardingState, getPrimaryHotelId, resolveMapsCoordinates: vi.fn() }));

const { POST } = await import("@/app/api/admin/onboarding/route");

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/admin/onboarding", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest);

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({ id: "u1" });
  getPrimaryHotelId.mockResolvedValue("h1");
  prismaMock.hotelContact.findFirst.mockResolvedValue(null);
});

describe("POST /api/admin/onboarding step you", () => {
  it("saves owner and manager contacts with their priority", async () => {
    const res = await post({
      step: "you",
      owner: { name: "Miguel", phone: "+52 954 111 1111", priority: "high" },
      manager: { name: "Clara", phone: "+52 954 222 2222", priority: "medium" },
    });
    expect(res.status).toBe(200);
    expect(prismaMock.hotelContact.create).toHaveBeenCalledWith({
      data: { hotelId: "h1", type: "OWNER", name: "Miguel", phone: "+52 954 111 1111", priority: "high" },
    });
    expect(prismaMock.hotelContact.create).toHaveBeenCalledWith({
      data: { hotelId: "h1", type: "MANAGER", name: "Clara", phone: "+52 954 222 2222", priority: "medium" },
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("updates an existing owner contact and skips an empty manager", async () => {
    prismaMock.hotelContact.findFirst.mockResolvedValue({ id: "c1" });
    await post({ step: "you", owner: { name: "Miguel", phone: "+52 954 111 1111", priority: "low" } });
    expect(prismaMock.hotelContact.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { name: "Miguel", phone: "+52 954 111 1111", priority: "low" },
    });
    expect(prismaMock.hotelContact.findFirst).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown priority", async () => {
    const res = await post({ step: "you", owner: { name: "M", phone: "+52 954 111 1111", priority: "urgent" } });
    expect(res.status).toBe(400);
  });

  it("still saves the signed-in user's own name and WhatsApp when there is no hotel yet", async () => {
    const res = await post({ step: "you", nickname: "Miguel", phoneNumber: "+52 954 111 1111" });
    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { nickname: "Miguel", phoneNumber: "+52 954 111 1111" },
    });
    expect((await post({ step: "you" })).status).toBe(400);
  });
});

describe("POST /api/admin/onboarding step payouts", () => {
  it("saves the Mercado Pago email and a valid CLABE (spaces stripped)", async () => {
    const res = await post({ step: "payouts", email: " Pagos@Hotel.mx ", clabe: "002 010 077777777771", holder: "Clara Torres" });
    expect(res.status).toBe(200);
    expect(prismaMock.hotel.update).toHaveBeenCalledWith({
      where: { id: "h1" },
      data: { payoutMercadoPagoEmail: "pagos@hotel.mx", payoutClabe: "002010077777777771", payoutAccountHolder: "Clara Torres" },
    });
  });

  it("accepts a Mercado Pago email alone", async () => {
    const res = await post({ step: "payouts", email: "pagos@hotel.mx", clabe: "", holder: "" });
    expect(res.status).toBe(200);
    expect(prismaMock.hotel.update).toHaveBeenCalledWith({
      where: { id: "h1" },
      data: { payoutMercadoPagoEmail: "pagos@hotel.mx", payoutClabe: null, payoutAccountHolder: null },
    });
  });

  it("rejects a CLABE with a bad control digit", async () => {
    const res = await post({ step: "payouts", clabe: "002010077777777772" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "clabe_invalid" });
    expect(prismaMock.hotel.update).not.toHaveBeenCalled();
  });

  it("requires an email or a CLABE", async () => {
    expect((await post({ step: "payouts", email: "", clabe: "" })).status).toBe(400);
  });
});
