import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiFetch,
  authenticate,
  clearSession,
  hasSession,
  readApiCache,
} from "./api";

const session = {
  access_token: "access-token",
  refresh_token: "refresh-token",
};

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value)),
  };
}

describe("authentication", () => {
  beforeEach(() => {
    Object.defineProperties(window, {
      localStorage: { configurable: true, value: memoryStorage() },
      sessionStorage: { configurable: true, value: memoryStorage() },
    });
    clearSession();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(session), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("sends only fields accepted by the login endpoint", async () => {
    await authenticate("login", {
      name: "Must not be sent",
      email: "person@example.com",
      password: "correct-horse-battery-staple",
      remember: true,
    });

    const [, request] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(request?.body))).toEqual({
      email: "person@example.com",
      password: "correct-horse-battery-staple",
    });
  });

  it("uses session storage when keep-signed-in is off", async () => {
    await authenticate("login", {
      email: "person@example.com",
      password: "correct-horse-battery-staple",
      remember: false,
    });

    expect(window.sessionStorage.getItem("settlr_access_token")).toBe(
      "access-token",
    );
    expect(window.localStorage.getItem("settlr_access_token")).toBeNull();
    expect(hasSession()).toBe(true);
  });

  it("uses durable storage when keep-signed-in is on", async () => {
    await authenticate("login", {
      email: "person@example.com",
      password: "correct-horse-battery-staple",
      remember: true,
    });

    expect(window.localStorage.getItem("settlr_access_token")).toBe(
      "access-token",
    );
    expect(window.sessionStorage.getItem("settlr_access_token")).toBeNull();
  });

  it("keeps a newly registered account signed out until email verification", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            id: "pending-user",
            name: "Pending Person",
            email: "pending@example.com",
          },
          email: "pending@example.com",
          verification_required: true,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await authenticate("register", {
      name: "Pending Person",
      email: "pending@example.com",
      password: "correct-horse-battery-staple",
    });

    expect(result).toMatchObject({ verification_required: true });
    expect(hasSession()).toBe(false);
  });

  it("coalesces repeated GETs and exposes warm data for instant route paint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: ["warm"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const [first, second] = await Promise.all([
      apiFetch<{ data: string[] }>("/api/v1/cache-probe"),
      apiFetch<{ data: string[] }>("/api/v1/cache-probe"),
    ]);

    expect(first).toEqual(second);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      readApiCache<{ data: string[] }>("/api/v1/cache-probe")?.data,
    ).toEqual(["warm"]);
  });
});
