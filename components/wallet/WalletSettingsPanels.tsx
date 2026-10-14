"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { DeleteOutlined, EditOutlined, SwapOutlined } from "@ant-design/icons";
import { Panel, PanelTitle, useConfirmation } from "../UI";
import { useSession } from "../SessionProvider";
import { apiFetch } from "../../lib/api";
import {
  CURRENCIES,
  DEFAULT_SETTINGS,
  Page,
  RateOverride,
  WalletSettings,
} from "../../lib/wallet";
import { errorText, fetchRatesFor, walletWrite } from "./data";

/** Fetched (provider) rate for reference: 1 base = ? quote. */
function useFetchedRate(base: string, quote: string) {
  const [rate, setRate] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    setRate(null);
    if (!base || !quote || base === quote) return;
    fetchRatesFor(base, quote)
      .then((r) => {
        if (cancelled || !r) return;
        const direct = r.base === base ? r.rates?.[quote] : undefined;
        const inverse = r.base === quote ? r.rates?.[base] : undefined;
        setRate(direct ?? (inverse ? 1 / inverse : null));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [base, quote]);
  return rate;
}

const fmtRate = (rate: number | null) =>
  rate == null ? "unavailable" : String(Number(rate.toPrecision(6)));

function FetchedRate({ base, quote }: { base: string; quote: string }) {
  const rate = useFetchedRate(base, quote);
  return <small>Fetched: {fmtRate(rate)}</small>;
}

const SETTING_TOGGLES: [keyof WalletSettings, string, string][] = [
  [
    "hide_balance",
    "Hide balances",
    "Mask totals and account balances until you reveal them.",
  ],
  ["hide_income", "Hide income", "Mask income figures in summaries."],
  [
    "treat_transfers_as_flow",
    "Count transfers as income and expense",
    "On account pages, money moved in or out counts as income or expense.",
  ],
];

export function WalletSettingsPanels({
  onSaved,
  onError,
}: {
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const requestConfirmation = useConfirmation();
  const { user, refresh } = useSession();
  const [settings, setSettings] = useState<WalletSettings>();
  const [overrides, setOverrides] = useState<RateOverride[]>([]);
  const [base, setBase] = useState(user?.default_currency || "NPR");
  const [quote, setQuote] = useState("USD");
  const [rateText, setRateText] = useState("");
  const fetchedForm = useFetchedRate(base, quote);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        apiFetch<WalletSettings>("/api/v1/me/settings"),
        apiFetch<Page<RateOverride>>("/api/v1/me/rates"),
      ]);
      setSettings({ ...DEFAULT_SETTINGS, ...s });
      setOverrides(r.data);
    } catch (cause) {
      onError(errorText(cause, "Could not load wallet settings."));
    }
  }, [onError]);
  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (change: Partial<WalletSettings>, message: string) => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, ...change });
    try {
      const saved = await walletWrite<WalletSettings>(
        "/api/v1/me/settings",
        "PATCH",
        change,
      );
      setSettings({ ...DEFAULT_SETTINGS, ...saved });
      onSaved(message);
    } catch (cause) {
      setSettings(previous);
      onError(errorText(cause, "Could not save the setting."));
    }
  };

  const saveCurrency = async (currency: string) => {
    try {
      await walletWrite("/api/v1/me", "PATCH", { default_currency: currency });
      await refresh();
      onSaved(`Base currency set to ${currency}.`);
    } catch (cause) {
      onError(errorText(cause, "Could not change the base currency."));
    }
  };

  const saveRate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rate = Number(rateText);
    if (base === quote) {
      onError("Choose two different currencies.");
      return;
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      onError("Enter a rate greater than zero.");
      return;
    }
    try {
      await walletWrite(`/api/v1/me/rates/${base}/${quote}`, "PUT", { rate });
      setRateText("");
      onSaved(`Rate saved: 1 ${base} = ${rate} ${quote}.`);
      await load();
    } catch (cause) {
      onError(errorText(cause, "Could not save the rate."));
    }
  };

  const removeRate = async (o: RateOverride) => {
    if (
      !(await requestConfirmation({
        title: `Remove your ${o.base}→${o.quote} rate?`,
        description: "Totals go back to the daily fetched rate.",
        confirmLabel: "Remove rate",
        danger: true,
      }))
    )
      return;
    try {
      await walletWrite(`/api/v1/me/rates/${o.base}/${o.quote}`, "DELETE");
      onSaved("Rate removed.");
      await load();
    } catch (cause) {
      onError(errorText(cause, "Could not remove the rate."));
    }
  };

  return (
    <>
      <Panel>
        <span id="wallet" />
        <PanelTitle
          title="Wallet"
          meta="How totals and periods are worked out"
        />
        <div className="form-grid">
          <label>
            Base currency
            <select
              value={user?.default_currency || "NPR"}
              onChange={(e) => void saveCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <small className="field-hint">
              Totals across accounts and your overall balances use it.
            </small>
          </label>
          <label>
            Month starts on day
            <select
              value={settings?.month_start_day ?? 1}
              disabled={!settings}
              onChange={(e) =>
                void patch(
                  { month_start_day: Number(e.target.value) },
                  "Month start day saved.",
                )
              }
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <small className="field-hint">
              For example 25 if you are paid on the 25th.
            </small>
          </label>
        </div>
        {settings &&
          SETTING_TOGGLES.map(([key, label, help]) => (
            <div className="setting-row" key={key}>
              <div>
                <strong>{label}</strong>
                <p>{help}</p>
              </div>
              <button
                type="button"
                className={settings[key] ? "toggle active" : "toggle"}
                role="switch"
                aria-checked={Boolean(settings[key])}
                aria-label={label}
                onClick={() =>
                  void patch(
                    { [key]: !settings[key] } as Partial<WalletSettings>,
                    `${label}: ${settings[key] ? "off" : "on"}.`,
                  )
                }
              >
                <i />
              </button>
            </div>
          ))}
      </Panel>
      <Panel>
        <span id="rates" />
        <PanelTitle
          title="Exchange rates"
          meta="Your own rates win over the daily fetched ones"
        />
        {overrides.length > 0 && (
          <ul className="rate-list">
            {overrides.map((o) => (
              <li key={`${o.base}-${o.quote}`} className="rate-row">
                <SwapOutlined aria-hidden="true" />
                <span>
                  <strong>
                    1 {o.base} = {fmtRate(o.rate)} {o.quote}
                  </strong>
                  <FetchedRate base={o.base} quote={o.quote} />
                </span>
                <span className="row-buttons">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Edit ${o.base} to ${o.quote} rate`}
                    onClick={() => {
                      setBase(o.base);
                      setQuote(o.quote);
                      setRateText(String(o.rate));
                      document.getElementById("rate-value")?.focus();
                    }}
                  >
                    <EditOutlined />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${o.base} to ${o.quote} rate`}
                    onClick={() => void removeRate(o)}
                  >
                    <DeleteOutlined />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <form className="stack-form rate-form" onSubmit={saveRate}>
          <div className="rate-form-grid">
            <label>
              From
              <select value={base} onChange={(e) => setBase(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              To
              <select value={quote} onChange={(e) => setQuote(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Rate (1 {base} = ? {quote})
              <input
                id="rate-value"
                inputMode="decimal"
                autoComplete="off"
                value={rateText}
                placeholder={
                  fetchedForm != null ? fmtRate(fetchedForm) : "e.g. 133.5"
                }
                onChange={(e) => setRateText(e.target.value)}
              />
            </label>
          </div>
          <p className="muted-copy">
            Fetched rate for reference: 1 {base} ={" "}
            {base === quote ? "1" : fmtRate(fetchedForm)} {quote}
          </p>
          <button className="button">Save rate</button>
        </form>
      </Panel>
    </>
  );
}
