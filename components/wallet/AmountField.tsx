"use client";
import { useId } from "react";
import {
  evaluateExpression,
  formatMoney,
  isExpression,
  parseAmount,
} from "../../lib/wallet";

/** Amount input that accepts sums like 1200*4 and shows the live result. */
export function AmountField({
  label,
  currency,
  value,
  onChange,
  autoFocus = false,
  large = false,
  hint,
  id,
}: {
  label: string;
  currency: string;
  value: string;
  onChange: (text: string) => void;
  autoFocus?: boolean;
  large?: boolean;
  hint?: string;
  id?: string;
}) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-amount`;
  const resultId = `${inputId}-result`;
  const parsed = evaluateExpression(value);
  const minor = parseAmount(value);
  return (
    <div className={large ? "field amount-entry" : "field"}>
      <label htmlFor={inputId}>
        {label} ({currency})
      </label>
      <input
        id={inputId}
        data-autofocus={autoFocus || undefined}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={resultId}
        aria-invalid={Boolean(value) && parsed === null}
      />
      <small id={resultId} aria-live="polite">
        {value && parsed === null
          ? "Not a valid amount or sum"
          : isExpression(value) && minor
            ? `= ${formatMoney(minor, currency)}`
            : hint || " "}
      </small>
    </div>
  );
}
