import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate, clearSession, hasSession } from "./api";

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
});
