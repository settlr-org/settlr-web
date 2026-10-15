"use client";
import { useRovingKeys } from "../RovingRadios";
import { PALETTE } from "../../lib/wallet";
import { ICON_CHOICES, ItemTile } from "./icons";

export function ColourPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (stored: string) => void;
}) {
  const values = PALETTE.map((p) => p.stored);
  const selected = values.find((v) => v.toLowerCase() === value.toLowerCase());
  const roving = useRovingKeys(values, selected ?? values[0], onChange);
  return (
    <div className="picker-field">
      <span className="picker-label" id="colour-picker-label">
        Colour
      </span>
      <div
        className="swatch-row"
        role="radiogroup"
        aria-labelledby="colour-picker-label"
        ref={roving.ref}
        onKeyDown={roving.onKeyDown}
      >
        {PALETTE.map((p, index) => {
          const on = p.stored === selected || (!selected && index === 0);
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={p.stored === selected}
              aria-label={p.label}
              tabIndex={on ? 0 : -1}
              className="swatch"
              style={{ ["--swatch" as string]: p.css }}
              onClick={() => onChange(p.stored)}
            />
          );
        })}
      </div>
    </div>
  );
}

export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color?: string;
  onChange: (icon: string) => void;
}) {
  const choices = ICON_CHOICES.includes(value)
    ? ICON_CHOICES
    : [value, ...ICON_CHOICES];
  const roving = useRovingKeys(choices, value, onChange);
  return (
    <div className="picker-field">
      <span className="picker-label" id="icon-picker-label">
        Icon
      </span>
      <div
        className="icon-grid"
        role="radiogroup"
        aria-labelledby="icon-picker-label"
        ref={roving.ref}
        onKeyDown={roving.onKeyDown}
      >
        {choices.map((name) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={value === name}
            aria-label={name.replace(/-/g, " ")}
            tabIndex={value === name ? 0 : -1}
            className="icon-choice"
            onClick={() => onChange(name)}
          >
            <ItemTile icon={name} color={value === name ? color : undefined} />
          </button>
        ))}
      </div>
    </div>
  );
}
