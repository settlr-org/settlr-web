"use client";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import {
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import {
  customPeriod,
  dateInput,
  Period,
  periodContaining,
  periodLabel,
  shiftPeriod,
} from "../../lib/wallet";

/** Month stepper (honours month_start_day) with a custom-range popover. */
export function PeriodSelector({
  period,
  startDay,
  onChange,
}: {
  period: Period;
  startDay: number;
  onChange: (period: Period) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const lastDay = new Date(
    period.to.getFullYear(),
    period.to.getMonth(),
    period.to.getDate() - 1,
  );

  useEffect(() => {
    if (!open) return;
    rootRef.current
      ?.querySelector<HTMLInputElement>(".period-popover input")
      ?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = customPeriod(String(data.get("from")), String(data.get("to")));
    if (!next) {
      setError("Choose a start date on or before the end date.");
      return;
    }
    setError("");
    setOpen(false);
    onChange(next);
  };

  return (
    <div className="period-selector" ref={rootRef}>
      <button
        type="button"
        className="icon-button"
        aria-label="Previous period"
        onClick={() => onChange(shiftPeriod(period, -1, startDay))}
      >
        <LeftOutlined />
      </button>
      <button
        type="button"
        ref={triggerRef}
        className="button period-label"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Period: ${periodLabel(period)}. Choose a custom range`}
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarOutlined />
        <span>{periodLabel(period)}</span>
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Next period"
        onClick={() => onChange(shiftPeriod(period, 1, startDay))}
      >
        <RightOutlined />
      </button>
      {open && (
        <div
          className="period-popover"
          id={panelId}
          role="group"
          aria-label="Custom range"
        >
          <form className="stack-form" onSubmit={apply}>
            <div className="form-grid">
              <label>
                From
                <input
                  type="date"
                  name="from"
                  defaultValue={dateInput(period.from)}
                  required
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  name="to"
                  defaultValue={dateInput(lastDay)}
                  required
                />
              </label>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="button-row">
              <button
                type="button"
                className="button"
                onClick={() => {
                  setOpen(false);
                  onChange(periodContaining(new Date(), startDay));
                }}
              >
                This month
              </button>
              <button className="button primary">Apply range</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
