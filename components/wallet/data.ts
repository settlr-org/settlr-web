"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, readApiCache } from "../../lib/api";
import {
  Account,
  DEFAULT_SETTINGS,
  FetchedRates,
  Page,
  sortAccounts,
  Tag,
  WalletCategory,
  WalletSettings,
} from "../../lib/wallet";

export const errorText = (cause: unknown, fallback: string) =>
  cause instanceof Error && cause.message ? cause.message : fallback;

/** JSON write with an Idempotency-Key so retries of creates are safe. */
export function walletWrite<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  options: { idempotencyKey?: string; keepalive?: boolean } = {},
) {
  return apiFetch<T>(path, {
    method,
    headers:
      method === "POST"
        ? { "Idempotency-Key": options.idempotencyKey ?? crypto.randomUUID() }
        : {},
    body: body === undefined ? undefined : JSON.stringify(body),
    // Small requests only (the browser caps keepalive bodies at 64KB).
    keepalive: options.keepalive,
  });
}

const ACCOUNTS = "/api/v1/accounts";
const CATEGORIES = "/api/v1/categories";
const TAGS = "/api/v1/tags";
const SETTINGS = "/api/v1/me/settings";

export type WalletRefs = {
  accounts: Account[];
  categories: WalletCategory[];
  tags: Tag[];
  settings: WalletSettings;
};

/** Accounts, categories, tags and wallet settings, served warm from the API cache. */
export function useWalletRefs() {
  const read = (): WalletRefs | undefined => {
    const a = readApiCache<Page<Account>>(ACCOUNTS);
    const c = readApiCache<Page<WalletCategory>>(CATEGORIES);
    const t = readApiCache<Page<Tag>>(TAGS);
    const s = readApiCache<WalletSettings>(SETTINGS);
    return a && c && t && s
      ? {
          accounts: sortAccounts(a.data),
          categories: c.data,
          tags: t.data,
          settings: { ...DEFAULT_SETTINGS, ...s },
        }
      : undefined;
  };
  const [refs, setRefs] = useState<WalletRefs | undefined>(read);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setError("");
    try {
      const [a, c, t, s] = await Promise.all([
        apiFetch<Page<Account>>(ACCOUNTS),
        apiFetch<Page<WalletCategory>>(CATEGORIES),
        apiFetch<Page<Tag>>(TAGS),
        apiFetch<WalletSettings>(SETTINGS),
      ]);
      const next = {
        accounts: sortAccounts(a.data),
        categories: c.data,
        tags: t.data,
        settings: { ...DEFAULT_SETTINGS, ...s },
      };
      setRefs(next);
      return next;
    } catch (cause) {
      setError(errorText(cause, "Could not load your wallet."));
      return undefined;
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  /** Saves a settings change optimistically. */
  const updateSettings = useCallback(
    async (patch: Partial<WalletSettings>) => {
      setRefs((r) => (r ? { ...r, settings: { ...r.settings, ...patch } } : r));
      try {
        const saved = await walletWrite<WalletSettings>(
          SETTINGS,
          "PATCH",
          patch,
        );
        setRefs((r) =>
          r ? { ...r, settings: { ...DEFAULT_SETTINGS, ...saved } } : r,
        );
      } catch (cause) {
        setError(errorText(cause, "Could not save the setting."));
        void reload();
      }
    },
    [reload],
  );
  return { refs, error, setError, reload, updateSettings };
}

/**
 * Fetched (provider) rates able to convert `from` → `to`: base=`from` when the
 * provider lists `to`, else base=`to` (resolveRate inverts it). Some providers
 * lack a pair from one side (e.g. USD→NPR) but have it from the other.
 */
export async function fetchRatesFor(
  from: string,
  to: string,
): Promise<FetchedRates | null> {
  const direct = await apiFetch<FetchedRates>(
    `/api/v1/rates?base=${from}`,
  ).catch(() => null);
  if (direct?.rates?.[to]) return direct;
  const inverse = await apiFetch<FetchedRates>(
    `/api/v1/rates?base=${to}`,
  ).catch(() => null);
  return inverse?.rates?.[from] ? inverse : direct;
}

export const categoryMap = (categories: WalletCategory[]) =>
  Object.fromEntries(categories.map((c) => [c.id, c]));
export const accountMap = (accounts: Account[]) =>
  Object.fromEntries(accounts.map((a) => [a.id, a]));
