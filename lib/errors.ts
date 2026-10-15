// Friendly copy for API failures. The API returns lowercase developer
// messages ("internal error", "must be a group member"); users should see a
// short sentence that says what happened and what to do next.

export const OFFLINE_MESSAGE =
  "You're offline or the server can't be reached. Check your connection and try again.";
export const SERVER_MESSAGE =
  "Something went wrong on our side. Please try again in a moment.";

const BY_CODE: Record<string, string> = {
  GROUP_MEMBER_REQUIRED: "You're not a member of this group.",
  FORBIDDEN: "You don't have access to this.",
  NOT_FOUND: "We couldn't find that. It may have been removed.",
  RATE_LIMITED: "Too many attempts. Wait a moment and try again.",
  RATES_UNAVAILABLE:
    "Exchange rates are unavailable right now. Try again shortly.",
  PAYLOAD_TOO_LARGE: "That is too large to upload.",
  IDEMPOTENCY_IN_PROGRESS: "That is already being saved. Give it a moment.",
  IDEMPOTENCY_KEY_REUSED: "That was already submitted. Refresh and try again.",
  IDEMPOTENCY_KEY_INVALID: "Something went wrong submitting that. Try again.",
  EMAIL_NOT_VERIFIED: "Verify your email address before signing in.",
  OAUTH_NOT_CONFIGURED: "Google sign-in isn't available right now.",
  INTERNAL: SERVER_MESSAGE,
};

/** "invalid or expired token" -> "Invalid or expired token." */
export function sentenceCase(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?…]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

/**
 * Map an API failure to user-facing copy. Validation-style codes keep the
 * server's detail (it names the field), tidied into a sentence.
 */
export function friendlyMessage(
  status: number,
  code: string | undefined,
  serverMessage: string,
): string {
  if (status === 0 || code === "NETWORK") return OFFLINE_MESSAGE;
  if (status >= 500) return SERVER_MESSAGE;
  if (code === "UNAUTHORIZED" && /invalid credentials/i.test(serverMessage))
    return "Incorrect email or password.";
  if (code && BY_CODE[code]) return BY_CODE[code];
  if (status === 401) return "Your session has ended. Sign in again.";
  if (status === 404) return BY_CODE.NOT_FOUND;
  if (status === 403) return BY_CODE.FORBIDDEN;
  if (status === 429) return BY_CODE.RATE_LIMITED;
  if (/^Request failed \(\d+\)$/.test(serverMessage))
    return "That didn't work. Please try again.";
  return sentenceCase(serverMessage);
}

export type FailureKind = "missing" | "retry";
export type LoadFailure = {
  message: string;
  kind: FailureKind;
  status?: number;
};

/**
 * True when retrying cannot help: the record does not exist or the user has
 * no access to it. The UI should offer a way back instead of "Try again".
 */
export function isMissingStatus(status: number | undefined): boolean {
  return status === 403 || status === 404;
}

export function toLoadFailure(cause: unknown, fallback: string): LoadFailure {
  const status =
    typeof (cause as { status?: unknown })?.status === "number"
      ? ((cause as { status: number }).status as number)
      : undefined;
  const message =
    cause instanceof Error && cause.message ? cause.message : fallback;
  return {
    message,
    status,
    kind: isMissingStatus(status) ? "missing" : "retry",
  };
}
