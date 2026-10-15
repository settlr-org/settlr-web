"use client";
import { PieChartOutlined } from "@ant-design/icons";
import { Empty } from "../../UI";
import { Segmented } from "../../RovingRadios";
import {
  donutArcs,
  donutSummary,
  type Breakdown,
  type Slice,
} from "../../../lib/reports";
import { amountScale, formatMoney } from "../../../lib/wallet";

/**
 * Category donut. The SVG is a picture (role=img with a text summary); the
 * legend rows below are the real, keyboard-operable controls and carry the
 * name, share, amount and count for every slice.
 */
export function CategoryDonut({
  slices,
  total,
  currency,
  breakdown,
  onBreakdown,
  onDrill,
  hidden = false,
}: {
  slices: Slice[];
  total: number;
  currency: string;
  breakdown: Breakdown;
  onBreakdown: (b: Breakdown) => void;
  onDrill: (slice: Slice) => void;
  hidden?: boolean;
}) {
  const noun = breakdown === "income" ? "Income" : "Spending";
  const arcs = donutArcs(slices);
  const amount = (n: number) => formatMoney(n, currency, { hidden });
  return (
    <section className="report-card" aria-labelledby="breakdown-title">
      <div className="report-card-head">
        <h2 id="breakdown-title">{noun} by category</h2>
        <Segmented<Breakdown>
          className="report-seg"
          label="Breakdown"
          value={breakdown}
          onChange={onBreakdown}
          options={[
            { value: "expense", label: "Spending" },
            { value: "income", label: "Income" },
          ]}
        />
      </div>
      {slices.length === 0 ? (
        <Empty
          icon={<PieChartOutlined />}
          title={`No ${noun.toLowerCase()} in this range`}
          text="Change the period or loosen a filter to see a breakdown."
        />
      ) : (
        <div className="donut-layout">
          <div className="donut-wrap">
            <svg
              viewBox="0 0 200 200"
              role="img"
              aria-label={donutSummary(`${noun} by category`, slices)}
              className="donut"
            >
              {slices.map((s, i) => (
                <path
                  key={s.key}
                  d={arcs[i]}
                  className="donut-slice"
                  style={{ fill: `var(--st-chart${(s.slot % 8) + 1})` }}
                  onClick={() => onDrill(s)}
                />
              ))}
            </svg>
            <div className="donut-centre" aria-hidden="true">
              <span>{noun === "Income" ? "Income" : "Spent"}</span>
              <strong data-amount-scale={amountScale(amount(total))}>
                {amount(total)}
              </strong>
            </div>
          </div>
          <ul className="legend" aria-label="Categories">
            {slices.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  className="legend-row"
                  onClick={() => onDrill(s)}
                  aria-label={`${s.name}: ${s.percent} percent, ${amount(s.amount)}, ${s.count} ${s.count === 1 ? "entry" : "entries"}. Show these entries`}
                >
                  <span
                    className="legend-swatch"
                    style={{ background: `var(--st-chart${(s.slot % 8) + 1})` }}
                    aria-hidden="true"
                  />
                  <span className="legend-name">{s.name}</span>
                  <span className="legend-pct">{s.percent}%</span>
                  <span className="legend-amount">{amount(s.amount)}</span>
                  <span className="legend-count">{s.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
