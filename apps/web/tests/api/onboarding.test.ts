// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const prismaMock = {
  user: { update: vi.fn() },
  hotel: { update: vi.fn() },
  hotelContact: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
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
  prismaMock.hotelContact.findMany.mockResolvedValue([]);
});

describe("POST /api/admin/onboarding step you", () => {
  it("saves the owner and every manager with their priority number", async () => {
    const res = await post({
      step: "you",
      owner: { name: "Miguel", phone: "+52 954 111 1111", priority: 2 },
      managers: [
        { name: "Clara", phone: "+52 954 222 2222", priority: 1 },
        { name: "Rosa", phone: "+52 954 333 3333", priority: 3 },
      ],
    });
    expect(res.status).toBe(200);
    expect(prismaMock.hotelContact.create).toHaveBeenCalledWith({
      data: { hotelId: "h1", type: "OWNER", name: "Miguel", phone: "+52 954 111 1111", priority: "2" },
    });
    expect(prismaMock.hotelContact.create).toHaveBeenCalledWith({
      data: { hotelId: "h1", type: "MANAGER", name: "Clara", phone: "+52 954 222 2222", priority: "1" },
    });
    expect(prismaMock.hotelContact.create).toHaveBeenCalledWith({
      data: { hotelId: "h1", type: "MANAGER", name: "Rosa", phone: "+52 954 333 3333", priority: "3" },
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("updates an existing owner contact and leaves managers alone when none are sent", async () => {
    prismaMock.hotelContact.findFirst.mockResolvedValue({ id: "c1" });
    await post({ step: "you", owner: { name: "Miguel", phone: "+52 954 111 1111", priority: 1 } });
    expect(prismaMock.hotelContact.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { name: "Miguel", phone: "+52 954 111 1111", priority: "1" },
    });
    expect(prismaMock.hotelContact.findMany).not.toHaveBeenCalled();
  });

  it("reuses existing manager rows and deletes the ones that were removed", async () => {
    prismaMock.hotelContact.findMany.mockResolvedValue([{ id: "m1" }, { id: "m2" }, { id: "m3" }]);
    await post({
      step: "you",
      owner: { name: "Miguel", phone: "+52 954 111 1111", priority: 1 },
      managers: [{ name: "Clara", phone: "+52 954 222 2222", priority: 2 }],
    });
    expect(prismaMock.hotelContact.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { name: "Clara", phone: "+52 954 222 2222", priority: "2" },
    });
    expect(prismaMock.hotelContact.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["m2", "m3"] } } });
  });

  it("rejects a priority that is not a rank number", async () => {
    const res = await post({ step: "you", owner: { name: "M", phone: "+52 954 111 1111", priority: 0 } });
    expect(res.status).toBe(400);
    const res2 = await post({ step: "you", owner: { name: "M", phone: "+52 954 111 1111", priority: "high" } });
    expect(res2.status).toBe(400);
  });

  it("renumbers ranks and reads legacy high/medium/low values", async () => {
    const { rankContacts, parseContactPriority } = await import("@/lib/contact-priority");
    expect(rankContacts([{ priority: 3 }, { priority: 1 }, { priority: null }]).map((c) => c.priority)).toEqual([2, 1, 3]);
    expect(["high", "medium", "low", "4", "x", null].map(parseContactPriority)).toEqual([1, 2, 3, 4, null, null]);
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
  it("saves a valid CLABE (spaces stripped) and the holder's full name", async () => {
    const res = await post({ step: "payouts", clabe: "002 010 077777777771", holder: " Clara Torres " });
    expect(res.status).toBe(200);
    expect(prismaMock.hotel.update).toHaveBeenCalledWith({
      where: { id: "h1" },
      data: { payoutClabe: "002010077777777771", payoutAccountHolder: "Clara Torres" },
    });
  });

  it("rejects a CLABE with a bad control digit", async () => {
    const res = await post({ step: "payouts", clabe: "002010077777777772", holder: "Clara Torres" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "clabe_invalid" });
    expect(prismaMock.hotel.update).not.toHaveBeenCalled();
  });

  it("requires both the CLABE and the holder's name", async () => {
    expect((await post({ step: "payouts", clabe: "", holder: "Clara Torres" })).status).toBe(400);
    expect((await post({ step: "payouts", clabe: "002010077777777771", holder: "" })).status).toBe(400);
    expect((await post({ step: "payouts", email: "pagos@hotel.mx" })).status).toBe(400);
    expect(prismaMock.hotel.update).not.toHaveBeenCalled();
  });
});
