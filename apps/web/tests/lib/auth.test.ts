import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const prismaMock = {
  session: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
  },
};

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  SESSION_COOKIE_NAME,
  hashPassword,
  verifyPassword,
  createSession,
  deleteCurrentSession,
  getCurrentUser,
} = await import("@/lib/auth");

describe("password hashing", () => {
  it("produces a bcrypt hash with 12 salt rounds that verifies", async () => {
    const hash = await hashPassword("s3cret-password");
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    await expect(verifyPassword("s3cret-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });
});

describe("session lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createSession stores a token and sets an httpOnly cookie", async () => {
    prismaMock.session.create.mockResolvedValue({});

    const token = await createSession("user-1");

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(prismaMock.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", sessionToken: token }),
    });
    const [name, value, options] = cookieStore.set.mock.calls[0];
    expect(name).toBe(SESSION_COOKIE_NAME);
    expect(value).toBe(token);
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("deleteCurrentSession removes the session row and cookie", async () => {
    cookieStore.get.mockReturnValue({ value: "tok" });

    await deleteCurrentSession();

    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
      where: { sessionToken: "tok" },
    });
    expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
  });

  it("deleteCurrentSession is a no-op without a cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);

    await deleteCurrentSession();

    expect(prismaMock.session.deleteMany).not.toHaveBeenCalled();
    expect(cookieStore.delete).not.toHaveBeenCalled();
  });

  it("getCurrentUser returns null without a cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(prismaMock.session.findFirst).not.toHaveBeenCalled();
  });

  it("getCurrentUser returns null for an expired or unknown session", async () => {
    cookieStore.get.mockReturnValue({ value: "tok" });
    prismaMock.session.findFirst.mockResolvedValue(null);

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("getCurrentUser returns the session user", async () => {
    cookieStore.get.mockReturnValue({ value: "tok" });
    prismaMock.session.findFirst.mockResolvedValue({ user: { id: "user-1" } });

    await expect(getCurrentUser()).resolves.toEqual({ id: "user-1" });
    expect(prismaMock.session.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sessionToken: "tok" }),
      })
    );
  });
});
