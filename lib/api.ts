const API_URL = "/api-proxy";
export type Session = {
  access_token: string;
  refresh_token: string;
  user?: User;
};
export type RegistrationResult = {
  user: User;
  email: string;
  verification_required: true;
  verification_token?: string;
};
export type User = {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  default_currency?: string;
  email_verified?: boolean;
};
const ACCESS_KEY = "settlr_access_token";
const REFRESH_KEY = "settlr_refresh_token";
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

const readToken = (key: string) =>
  window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
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
      );
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
}
export const hasSession = () =>
  typeof window !== "undefined" &&
  Boolean(readToken(REFRESH_KEY) || readToken(ACCESS_KEY));
export const clearSession = () => {
  clearApiCache();
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.sessionStorage.removeItem(ACCESS_KEY);
  window.sessionStorage.removeItem(REFRESH_KEY);
};
export const saveSession = (session: Session, remember = true) => {
  clearSession();
  const storage = remember ? window.localStorage : window.sessionStorage;
  storage.setItem(ACCESS_KEY, session.access_token);
  storage.setItem(REFRESH_KEY, session.refresh_token);
};

async function parseError(response: Response) {
  try {
    return (
      ((await response.json()) as { error?: { message?: string } }).error
        ?.message || `Request failed (${response.status})`
    );
  } catch {
    return `Request failed (${response.status})`;
  }
}

async function refreshAccessToken() {
  const refreshToken = readToken(REFRESH_KEY);
  if (!refreshToken) return null;
  const response = await fetchWithTimeout(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    clearSession();
    return null;
  }
  const session = (await response.json()) as Session;
  saveSession(session, Boolean(window.localStorage.getItem(REFRESH_KEY)));
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
  const token = typeof window === "undefined" ? null : readToken(ACCESS_KEY);
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
  if (!response.ok)
    throw new ApiError(response.status, await parseError(response));
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
  const result = await apiFetch<Session | RegistrationResult>(
    `/api/v1/auth/${mode}`,
    { method: "POST", body: JSON.stringify(body) },
    false,
  );
  if (mode === "login") saveSession(result as Session, Boolean(input.remember));
  return result;
}

export async function logout() {
  const refreshToken = readToken(REFRESH_KEY);
  try {
    await apiFetch(
      "/api/v1/auth/logout",
      { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) },
      false,
    );
  } finally {
    clearSession();
  }
}

export async function apiDownload(path: string, filename: string) {
  const headers = new Headers({ Accept: "text/csv" });
  const token = readToken(ACCESS_KEY);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response = await fetchWithTimeout(`${API_URL}${path}`, { headers });
  if (response.status === 401 && (await refreshAccessToken())) {
    const refreshed = readToken(ACCESS_KEY);
    if (refreshed) headers.set("Authorization", `Bearer ${refreshed}`);
    response = await fetchWithTimeout(`${API_URL}${path}`, { headers });
  }
  if (!response.ok)
    throw new ApiError(response.status, await parseError(response));
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
