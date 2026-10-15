import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  friendlyMessage,
  isMissingStatus,
  OFFLINE_MESSAGE,
  sentenceCase,
  SERVER_MESSAGE,
  toLoadFailure,
} from "../lib/errors";
import {
  apiFetch,
  ApiError,
  clearSession,
  saveSession,
  hasSession,
} from "../lib/api";

describe("friendlyMessage", () => {
  it("maps API codes to human copy", () => {
    expect(
      friendlyMessage(403, "GROUP_MEMBER_REQUIRED", "must be a group member"),
    ).toBe("You're not a member of this group.");
    expect(friendlyMessage(404, "NOT_FOUND", "resource not found")).toBe(
      "We couldn't find that. It may have been removed.",
    );
    expect(friendlyMessage(429, "RATE_LIMITED", "slow down")).toMatch(
      /Too many attempts/,
    );
    expect(friendlyMessage(503, "RATES_UNAVAILABLE", "x")).toBe(SERVER_MESSAGE);
    expect(friendlyMessage(422, "RATES_UNAVAILABLE", "x")).toMatch(
      /Exchange rates/,
    );
  });

  it("hides internal error text behind a server message", () => {
    expect(friendlyMessage(500, "INTERNAL", "internal error")).toBe(
      SERVER_MESSAGE,
    );
    expect(friendlyMessage(502, undefined, "bad gateway")).toBe(SERVER_MESSAGE);
  });

  it("turns bad credentials into a plain sentence", () => {
    expect(friendlyMessage(401, "UNAUTHORIZED", "invalid credentials")).toBe(
      "Incorrect email or password.",
    );
  });

  it("keeps validation detail but capitalises it", () => {
    expect(
      friendlyMessage(400, "VALIDATION_ERROR", "invalid or expired token"),
    ).toBe("Invalid or expired token.");
    expect(
      friendlyMessage(422, "VALIDATION_ERROR", "Amount must be positive."),
    ).toBe("Amount must be positive.");
  });

  it("explains network failures and status-only responses", () => {
    expect(friendlyMessage(0, "NETWORK", "Failed to fetch")).toBe(
      OFFLINE_MESSAGE,
    );
    expect(friendlyMessage(418, undefined, "Request failed (418)")).toBe(
      "That didn't work. Please try again.",
    );
  });
});

describe("sentenceCase", () => {
  it("capitalises and ends with punctuation once", () => {
    expect(sentenceCase("must be a group member")).toBe(
      "Must be a group member.",
    );
    expect(sentenceCase("Already done!")).toBe("Already done!");
    expect(sentenceCase("  ")).toBe("");
  });
});

describe("toLoadFailure", () => {
  it("offers a way back for 403/404 and a retry otherwise", () => {
    expect(isMissingStatus(404)).toBe(true);
    expect(isMissingStatus(403)).toBe(true);
    expect(isMissingStatus(500)).toBe(false);
    expect(
      toLoadFailure(new ApiError(404, "resource not found", "NOT_FOUND"), "x"),
    ).toMatchObject({
      kind: "missing",
      status: 404,
      message: "We couldn't find that. It may have been removed.",
    });
    expect(
      toLoadFailure(new ApiError(500, "internal error", "INTERNAL"), "x"),
    ).toMatchObject({
      kind: "retry",
      message: SERVER_MESSAGE,
    });
    expect(toLoadFailure("boom", "Could not load.")).toEqual({
      message: "Could not load.",
      kind: "retry",
      status: undefined,
    });
  });
});

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

const failure = async (call: Promise<unknown>) =>
  (await call.then(
    () => undefined,
    (e: unknown) => e,
  )) as ApiError;

describe("apiFetch error handling", () => {
  beforeEach(() => {
    Object.defineProperties(window, {
      localStorage: { configurable: true, value: memoryStorage() },
      sessionStorage: { configurable: true, value: memoryStorage() },
    });
    clearSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("exposes friendly text and keeps the raw server message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "INTERNAL", message: "internal error" },
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const error = await failure(apiFetch("/api/v1/groups"));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe(SERVER_MESSAGE);
    expect(error.serverMessage).toBe("internal error");
    expect(error.status).toBe(500);
  });

  it("reports a dropped connection as an offline error, not 'Failed to fetch'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    const error = await failure(apiFetch("/api/v1/me"));
    expect(error).toMatchObject({
      status: 0,
      code: "NETWORK",
      message: OFFLINE_MESSAGE,
    });
  });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  it("keeps the session when the refresh endpoint fails with a 5xx", async () => {
    saveSession({ access_token: "t" }, true);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        // The API call expires the access token ...
        .mockResolvedValueOnce(
          json(401, { error: { code: "UNAUTHORIZED", message: "expired" } }),
        )
        // ... and the refresh endpoint itself is having a bad moment.
        .mockResolvedValueOnce(
          json(503, { error: { code: "INTERNAL", message: "x" } }),
        ),
    );
    const error = await failure(apiFetch("/api/v1/me"));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(503);
    expect(hasSession()).toBe(true);
  });

  it("keeps the session when the refresh request cannot reach the server", async () => {
    saveSession({ access_token: "t" }, true);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          json(401, { error: { code: "UNAUTHORIZED", message: "expired" } }),
        )
        .mockRejectedValueOnce(new TypeError("Failed to fetch")),
    );
    const error = await failure(apiFetch("/api/v1/me"));
    expect(error).toMatchObject({ status: 0, code: "NETWORK" });
    expect(hasSession()).toBe(true);
  });

  it("ends the session only when the refresh token is rejected (401)", async () => {
    saveSession({ access_token: "t" }, true);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          json(401, { error: { code: "UNAUTHORIZED", message: "expired" } }),
        )
        .mockResolvedValueOnce(
          json(401, { error: { code: "UNAUTHORIZED", message: "expired" } }),
        ),
    );
    await apiFetch("/api/v1/me").catch(() => undefined);
    expect(hasSession()).toBe(false);
  });
});
