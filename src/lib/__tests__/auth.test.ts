// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { jwtVerify } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieSet = vi.fn();
const mockCookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ set: mockCookieSet, get: mockCookieGet })),
}));

import { createSession, getSession } from "@/lib/auth";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sets a cookie named auth-token", async () => {
    await createSession("user-1", "test@example.com");
    expect(mockCookieSet).toHaveBeenCalledWith(
      "auth-token",
      expect.any(String),
      expect.any(Object)
    );
  });

  test("JWT contains the correct userId and email", async () => {
    await createSession("user-42", "user@example.com");
    const [, token] = mockCookieSet.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);
    expect(payload.userId).toBe("user-42");
    expect(payload.email).toBe("user@example.com");
  });

  test("JWT is signed with HS256", async () => {
    await createSession("user-1", "test@example.com");
    const [, token] = mockCookieSet.mock.calls[0];
    const [headerB64] = token.split(".");
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
    expect(header.alg).toBe("HS256");
  });

  test("cookie is httpOnly with lax sameSite and root path", async () => {
    await createSession("user-1", "test@example.com");
    const [, , options] = mockCookieSet.mock.calls[0];
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("cookie expires approximately 7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "test@example.com");
    const after = Date.now();
    const [, , options] = mockCookieSet.mock.calls[0];
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(options.expires.getTime()).toBeGreaterThanOrEqual(before + sevenDays);
    expect(options.expires.getTime()).toBeLessThanOrEqual(after + sevenDays);
  });

  test("cookie is not secure outside production", async () => {
    await createSession("user-1", "test@example.com");
    const [, , options] = mockCookieSet.mock.calls[0];
    expect(options.secure).toBe(false);
  });

  test("cookie is secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createSession("user-1", "test@example.com");
    const [, , options] = mockCookieSet.mock.calls[0];
    expect(options.secure).toBe(true);
    vi.unstubAllEnvs();
  });

  test("JWT exp claim is set to approximately 7 days from now", async () => {
    const before = Math.floor(Date.now() / 1000);
    await createSession("user-1", "test@example.com");
    const after = Math.floor(Date.now() / 1000);
    const [, token] = mockCookieSet.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sevenDays = 7 * 24 * 60 * 60;
    expect(payload.exp).toBeGreaterThanOrEqual(before + sevenDays);
    expect(payload.exp).toBeLessThanOrEqual(after + sevenDays + 1);
  });

  test("JWT iat claim is set to approximately now", async () => {
    const before = Math.floor(Date.now() / 1000);
    await createSession("user-1", "test@example.com");
    const after = Math.floor(Date.now() / 1000);
    const [, token] = mockCookieSet.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);
    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(after + 1);
  });

  test("expiresAt in JWT payload matches cookie expires", async () => {
    await createSession("user-1", "test@example.com");
    const [, token, options] = mockCookieSet.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const payloadExpires = new Date(payload.expiresAt as string).getTime();
    expect(payloadExpires).toBe(options.expires.getTime());
  });

  test("token is a compact JWT with three base64url parts", async () => {
    await createSession("user-1", "test@example.com");
    const [, token] = mockCookieSet.mock.calls[0];
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    const base64url = /^[A-Za-z0-9_-]+$/;
    parts.forEach((part: string) => expect(part).toMatch(base64url));
  });

  test("token fails verification with a different secret", async () => {
    await createSession("user-1", "test@example.com");
    const [, token] = mockCookieSet.mock.calls[0];
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    await expect(jwtVerify(token, wrongSecret)).rejects.toThrow();
  });

  test("successive calls produce distinct tokens", async () => {
    await createSession("user-1", "test@example.com");
    await createSession("user-1", "test@example.com");
    const [, token1] = mockCookieSet.mock.calls[0];
    const [, token2] = mockCookieSet.mock.calls[1];
    expect(token1).not.toBe(token2);
  });

  test("sets cookie once per call", async () => {
    await createSession("user-1", "test@example.com");
    expect(mockCookieSet).toHaveBeenCalledTimes(1);
  });
});

describe("getSession", () => {
  const makeToken = (
    payload: object,
    secret = JWT_SECRET,
    expiresIn = "7d"
  ) =>
    new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(expiresIn)
      .setIssuedAt()
      .sign(secret);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns null when the cookie is absent", async () => {
    mockCookieGet.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns null when the cookie has no value", async () => {
    mockCookieGet.mockReturnValue({ value: undefined });
    expect(await getSession()).toBeNull();
  });

  test("returns the session payload from a valid token", async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = await makeToken({ userId: "user-1", email: "a@b.com", expiresAt });
    mockCookieGet.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.userId).toBe("user-1");
    expect(session?.email).toBe("a@b.com");
  });

  test("returns expiresAt from the token payload", async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = await makeToken({ userId: "user-1", email: "a@b.com", expiresAt });
    mockCookieGet.mockReturnValue({ value: token });

    const session = await getSession();
    expect(new Date(session!.expiresAt).getTime()).toBeCloseTo(expiresAt.getTime(), -3);
  });

  test("returns null for a token signed with a different secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await makeToken({ userId: "user-1", email: "a@b.com" }, wrongSecret);
    mockCookieGet.mockReturnValue({ value: token });

    expect(await getSession()).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken({ userId: "user-1", email: "a@b.com" }, JWT_SECRET, "-1s");
    mockCookieGet.mockReturnValue({ value: token });

    expect(await getSession()).toBeNull();
  });

  test("returns null for a malformed token string", async () => {
    mockCookieGet.mockReturnValue({ value: "not.a.jwt" });
    expect(await getSession()).toBeNull();
  });

  test("returns null for an empty token string", async () => {
    mockCookieGet.mockReturnValue({ value: "" });
    expect(await getSession()).toBeNull();
  });

  test("looks up the auth-token cookie by name", async () => {
    mockCookieGet.mockReturnValue(undefined);
    await getSession();
    expect(mockCookieGet).toHaveBeenCalledWith("auth-token");
  });
});
