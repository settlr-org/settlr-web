"use client";

import { GoogleOAuthProvider as Provider } from "@react-oauth/google";
import { ReactNode } from "react";

const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

export function GoogleOAuthProvider({ children }: { children: ReactNode }) {
  if (!clientId) return <>{children}</>;
  return <Provider clientId={clientId}>{children}</Provider>;
}

export function googleOAuthEnabled() {
  return Boolean(clientId);
}
