// Small per-tab preferences kept in sessionStorage. Storage can be missing or
// throw (private windows, blocked site data), so every access is guarded.

const SHOW_ADJUSTMENTS_KEY = "settlr_show_adjustments";

export function readFlag(
  key: string,
  storage: Pick<Storage, "getItem"> | undefined = safeStorage(),
): boolean {
  try {
    return storage?.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeFlag(
  key: string,
  value: boolean,
  storage: Pick<Storage, "setItem" | "removeItem"> | undefined = safeStorage(),
): void {
  try {
    if (value) storage?.setItem(key, "1");
    else storage?.removeItem(key);
  } catch {
    // Not persisted; the choice still applies for this page view.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export const readShowAdjustments = () => readFlag(SHOW_ADJUSTMENTS_KEY);
export const writeShowAdjustments = (value: boolean) =>
  writeFlag(SHOW_ADJUSTMENTS_KEY, value);
