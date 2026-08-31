import { NextRequest, NextResponse } from "next/server";

const upstream = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "https://api.example.com"
).replace(/\/$/, "");

const refreshCookie =
  process.env.NODE_ENV === "production"
    ? "__Host-settlr_refresh"
    : "settlr_refresh";
const refreshMaxAge = 60 * 60 * 24 * 30;
const isStateChanging = (method: string) =>
  !["GET", "HEAD", "OPTIONS"].includes(method);

function rejectCrossOriginRequest(request: NextRequest) {
  if (!isStateChanging(request.method)) return false;
  const origin = request.headers.get("origin");
  return Boolean(origin && origin !== request.nextUrl.origin);
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  if (rejectCrossOriginRequest(request)) {
    return NextResponse.json(
      {
        error: { code: "FORBIDDEN", message: "cross-origin request rejected" },
      },
      { status: 403 },
    );
  }
  const { path } = await context.params;
  const url = new URL(`${upstream}/${path.join("/")}`);
  request.nextUrl.searchParams.forEach((value, key) =>
    url.searchParams.append(key, value),
  );
  const headers = new Headers();
  for (const name of [
    "accept",
    "authorization",
    "content-type",
    "idempotency-key",
    "x-request-id",
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const isRefreshOrLogout =
    path.join("/") === "api/v1/auth/refresh" ||
    path.join("/") === "api/v1/auth/logout";
  if (isRefreshOrLogout) {
    const token = request.cookies.get(refreshCookie)?.value;
    if (token) {
      headers.set("content-type", "application/json");
    }
  }
  let body: BodyInit | undefined =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
  if (isRefreshOrLogout) {
    const token = request.cookies.get(refreshCookie)?.value;
    body = JSON.stringify({ refresh_token: token ?? "" });
  }
  const response = await fetch(url, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  });
  const loginOrRefresh =
    path.join("/") === "api/v1/auth/login" ||
    path.join("/") === "api/v1/auth/google" ||
    path.join("/") === "api/v1/auth/refresh";
  if (!loginOrRefresh) {
    const result = new NextResponse(response.body, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
    if (path.join("/") === "api/v1/auth/logout")
      result.cookies.delete(refreshCookie);
    return result;
  }
  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const token =
    typeof payload?.refresh_token === "string" ? payload.refresh_token : null;
  if (payload) delete payload.refresh_token;
  const result = NextResponse.json(payload, { status: response.status });
  if (token && response.ok) {
    const persistent = request.headers.get("x-settlr-session") === "persistent";
    result.cookies.set(refreshCookie, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      ...(persistent ? { maxAge: refreshMaxAge } : {}),
    });
  }
  return result;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
