// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = {
  user: { findFirst: vi.fn(), create: vi.fn() },
  hotel: { create: vi.fn() },
};
const authMock = {
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(),
  createSession: vi.fn(),
  deleteCurrentSession: vi.fn(),
  getCurrentUser: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => authMock);

const { POST: signIn } = await import("@/app/api/auth/sign-in/route");
const { POST: signUp } = await import("@/app/api/auth/sign-up/route");
const { POST: signOut } = await import("@/app/api/auth/sign-out/route");
const { GET: me } = await import("@/app/api/auth/me/route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/auth/sign-in", () => {
  it("rejects an invalid payload with 400", async () => {
    const res = await signIn(jsonRequest({ email_or_username: "a", password: "123" }));
    expect(res.status).toBe(400);
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("returns 401 for an unknown user", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    const res = await signIn(jsonRequest({ email_or_username: "nobody", password: "secret" }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Invalid credentials" });
  });

  it("returns 401 for a wrong password", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "u1", passwordHash: "h" });
    authMock.verifyPassword.mockResolvedValue(false);

    const res = await signIn(jsonRequest({ email_or_username: "user", password: "secret" }));

    expect(res.status).toBe(401);
    expect(authMock.createSession).not.toHaveBeenCalled();
  });

  it("creates a session on success", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "u1",
      passwordHash: "h",
      username: "user",
      email: "user@example.com",
    });
    authMock.verifyPassword.mockResolvedValue(true);

    const res = await signIn(jsonRequest({ email_or_username: "user", password: "secret" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      user: { id: "u1", username: "user", email: "user@example.com" },
    });
    expect(authMock.createSession).toHaveBeenCalledWith("u1");
  });

  it("returns 500 on unexpected failures without leaking details", async () => {
    prismaMock.user.findFirst.mockRejectedValue(new Error("db exploded"));

    const res = await signIn(jsonRequest({ email_or_username: "user", password: "secret" }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal Server Error" });
  });
});

describe("POST /api/auth/sign-up", () => {
  const validBody = {
    username: "owner",
    email: "owner@example.com",
    password: "secret1",
    hotel_name: "Aldeita",
  };

  it("rejects an invalid payload with 400", async () => {
    const res = await signUp(jsonRequest({ username: "ab" }));
    expect(res.status).toBe(400);
  });

  it("returns 409 when the user already exists", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "u1" });

    const res = await signUp(jsonRequest(validBody));

    expect(res.status).toBe(409);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("creates the user, its hotel with listings and a session", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "u1",
      username: "owner",
      email: "owner@example.com",
      hotelName: "Aldeita",
    });
    prismaMock.hotel.create.mockResolvedValue({ id: "h1" });

    const res = await signUp(
      jsonRequest({
        ...validBody,
        units: [
          {
            name_of_unit: "Suite 1",
            num_of_guests: 2,
            description: "Nice",
            number_of_beds: 1,
            number_of_bathrooms: 1,
            cost_night: 120,
            calendar: "https://www.airbnb.com/calendar/ical/1.ics",
          },
        ],
      })
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      user: { id: "u1", username: "owner", email: "owner@example.com", hotelName: "Aldeita" },
      hotelId: "h1",
    });
    expect(authMock.hashPassword).toHaveBeenCalledWith("secret1");
    expect(prismaMock.hotel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          listings: {
            create: [expect.objectContaining({ title: "Suite 1", nightlyBasePrice: 12000 })],
          },
        }),
      })
    );
    expect(authMock.createSession).toHaveBeenCalledWith("u1");
  });

  it("returns 500 on unexpected failures", async () => {
    prismaMock.user.findFirst.mockRejectedValue(new Error("db exploded"));

    const res = await signUp(jsonRequest(validBody));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal Server Error" });
  });
});

describe("POST /api/auth/sign-out", () => {
  it("clears the current session", async () => {
    const res = await signOut();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(authMock.deleteCurrentSession).toHaveBeenCalled();
  });
});

describe("GET /api/auth/me", () => {
  it("returns a null user when signed out", async () => {
    authMock.getCurrentUser.mockResolvedValue(null);

    const res = await me();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ user: null });
  });

  it("returns only public fields for the signed-in user", async () => {
    authMock.getCurrentUser.mockResolvedValue({
      id: "u1",
      username: "owner",
      email: "owner@example.com",
      verified: true,
      passwordHash: "secret-hash",
    });

    const res = await me();

    await expect(res.json()).resolves.toEqual({
      user: { id: "u1", username: "owner", email: "owner@example.com", verified: true },
    });
  });
});
