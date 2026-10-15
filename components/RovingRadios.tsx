"use client";
import { KeyboardEvent, ReactNode, useRef } from "react";
import { nextRadioIndex } from "../lib/a11y";

/** Arrow keys move between radio options (roving tab index, as native radios do). */
export function useRovingKeys<T>(
  values: T[],
  current: T,
  onChange: (value: T) => void,
) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = nextRadioIndex(
      event.key,
      values.indexOf(current),
      values.length,
    );
    if (next === null) return;
    event.preventDefault();
    onChange(values[next]);
    ref.current
      ?.querySelectorAll<HTMLButtonElement>("[role=radio]")
      [next]?.focus();
  };
  return { ref, onKeyDown };
}

/** A segmented radio group: one tab stop, arrow keys change the selection. */
export function Segmented<T extends string | boolean>({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const roving = useRovingKeys(
    options.map((o) => o.value),
    value,
    onChange,
  );
  return (
    <div
      className={`segmented ${className}`.trim()}
      role="radiogroup"
      aria-label={label}
      ref={roving.ref}
      onKeyDown={roving.onKeyDown}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          className={value === o.value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
