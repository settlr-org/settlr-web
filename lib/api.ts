import type { User } from "./types";
import { friendlyMessage, OFFLINE_MESSAGE } from "./errors";

export type { User };

const API_URL = "/api-proxy";
export type Session = {
  access_token: string;
  user?: User;
};
export type RegistrationResult = {
  user: User;
  email: string;
  verification_required: true;
  verification_token?: string;
};
const SESSION_KEY = "settlr_session";
let accessToken: string | null = null;
const GET_CACHE_MS = 60_000;
type CacheEntry = {
  expiresAt: number;
  promise: Promise<unknown>;
  value?: unknown;
};
const requestCache = new Map<string, CacheEntry>();

export const readApiCache = <T>(path: string) =>
  requestCache.get(path)?.value as T | undefined;
export const clearApiCache = () => requestCache.clear();

export class ApiError extends Error {
  /** The raw message from the API body (developer-facing, not for display). */
  public serverMessage: string;
  constructor(
    public status: number,
    message: string,
    /** Machine-readable error code from the API body (e.g. RATES_UNAVAILABLE). */
    public code?: string,
    friendly = true,
  ) {
    super(friendly ? friendlyMessage(status, code, message) : message);
    this.serverMessage = message;
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );
  const abort = () => controller.abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError(
        408,
        "The server took too long to respond. Please try again.",
        "TIMEOUT",
        false,
      );
    }
    // fetch() rejects with a TypeError when the network is down.
    throw new ApiError(0, OFFLINE_MESSAGE, "NETWORK", false);
  } finally {
    globalThis.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
}
export const hasSession = () =>
  typeof window !== "undefined" &&
  Boolean(
    accessToken ||
    window.localStorage.getItem(SESSION_KEY) ||
    window.sessionStorage.getItem(SESSION_KEY),
  );
export const clearSession = () => {
  clearApiCache();
  accessToken = null;
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
};
export const saveSession = (session: Session, remember = true) => {
  clearSession();
  const storage = remember ? window.localStorage : window.sessionStorage;
  accessToken = session.access_token;
  // This marker is not a credential. It lets a reload attempt a cookie-backed
  // refresh before deciding the user has been signed out.
  storage.setItem(SESSION_KEY, "1");
};

async function toApiError(response: Response) {
  const { message, code } = await parseErrorBody(response);
  return new ApiError(response.status, message, code);
}

async function parseErrorBody(
  response: Response,
): Promise<{ message: string; code?: string }> {
  const fallback = `Request failed (${response.status})`;
  try {
    const error = (
      (await response.json()) as {
        error?: { message?: string; code?: string };
      }
    ).error;
    return { message: error?.message || fallback, code: error?.code };
  } catch {
    return { message: fallback };
  }
}

// Refresh tokens rotate on every use, so concurrent 401s must share one
// refresh call; a second call would present the already-rotated cookie,
// fail, and sign the user out.
let refreshInFlight: Promise<string | null> | null = null;
function refreshAccessToken() {
  refreshInFlight ??= requestAccessToken().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function requestAccessToken() {
  const response = await fetchWithTimeout(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
  });
  if (!response.ok) {
    // Only a rejected refresh token ends the session. A 5xx or a network
    // failure is transient: keep the session so the next attempt can work.
    if (response.status === 401 || response.status === 403) clearSession();
    else throw await toApiError(response);
    return null;
  }
  const session = (await response.json()) as Session;
  accessToken = session.access_token;
  return session.access_token;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const cacheable = method === "GET" && !init.body && retry;
  if (cacheable) {
    const cached = requestCache.get(path);
    if (cached && cached.expiresAt > Date.now())
      return cached.promise as Promise<T>;
    const entry: CacheEntry = {
      expiresAt: Date.now() + GET_CACHE_MS,
      promise: Promise.resolve(undefined),
      value: cached?.value,
    };
    entry.promise = performRequest<T>(path, init, retry)
      .then((value) => {
        entry.value = value;
        return value;
      })
      .catch((error) => {
        if (requestCache.get(path) === entry) requestCache.delete(path);
        throw error;
      });
    requestCache.set(path, entry);
    return entry.promise as Promise<T>;
  }
  const value = await performRequest<T>(path, init, retry);
  if (method !== "GET") clearApiCache();
  return value;
}

async function performRequest<T>(
  path: string,
  init: RequestInit,
  retry: boolean,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  )
    headers.set("Content-Type", "application/json");
  // After a reload the access token is gone but the refresh cookie usually
  // is not: refresh first instead of sending a request that is sure to 401.
  if (retry && typeof window !== "undefined" && !accessToken && hasSession())
    await refreshAccessToken();
  const token = typeof window === "undefined" ? null : accessToken;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetchWithTimeout(`${API_URL}${path}`, {
    ...init,
    headers,
  });
  if (
    response.status === 401 &&
    retry &&
    typeof window !== "undefined" &&
    (await refreshAccessToken())
  )
    return performRequest<T>(path, init, false);
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function authenticate(
  mode: "login" | "register",
  input: {
    name?: string;
    email: string;
    password: string;
    remember?: boolean;
  },
): Promise<Session | RegistrationResult> {
  const body =
    mode === "register"
      ? { name: input.name, email: input.email, password: input.password }
      : { email: input.email, password: input.password };
  const headers =
    mode === "login"
      ? { "X-Settlr-Session": input.remember ? "persistent" : "session" }
      : undefined;
  const result = await apiFetch<Session | RegistrationResult>(
    `/api/v1/auth/${mode}`,
    { method: "POST", headers, body: JSON.stringify(body) },
    false,
  );
  if (mode === "login") saveSession(result as Session, Boolean(input.remember));
  return result;
}

export async function authenticateWithGoogle(
  idToken: string,
  remember = true,
): Promise<Session> {
  const result = await apiFetch<Session>(
    "/api/v1/auth/google",
    {
      method: "POST",
      headers: { "X-Settlr-Session": remember ? "persistent" : "session" },
      body: JSON.stringify({ id_token: idToken }),
    },
    false,
  );
  saveSession(result, remember);
  return result;
}

export async function logout() {
  try {
    await apiFetch("/api/v1/auth/logout", { method: "POST" }, false);
  } finally {
    clearSession();
  }
}

export async function apiDownload(path: string, filename: string) {
  const headers = new Headers({ Accept: "text/csv" });
  const token = accessToken;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response = await fetchWithTimeout(`${API_URL}${path}`, { headers });
  if (response.status === 401 && (await refreshAccessToken())) {
    const refreshed = accessToken;
    if (refreshed) headers.set("Authorization", `Bearer ${refreshed}`);
    response = await fetchWithTimeout(`${API_URL}${path}`, { headers });
  }
  if (!response.ok) throw await toApiError(response);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
