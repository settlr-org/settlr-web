"use client";
import { useState } from "react";
import { BarChartOutlined } from "@ant-design/icons";
import { Empty } from "../../UI";
import { Segmented } from "../../RovingRadios";
import {
  barLayout,
  bucketLabel,
  compactAmount,
  type Bucket,
  type TrendBucket,
} from "../../../lib/reports";
import { formatMoney } from "../../../lib/wallet";

const W = 640;
const H = 200;
const PAD = { l: 44, r: 8, t: 8, b: 26 };

/** Income vs spending bars with a net line. Bars are focusable with text labels. */
export function TrendChart({
  buckets,
  bucket,
  onBucket,
  currency,
}: {
  buckets: TrendBucket[];
  bucket: Bucket;
  onBucket: (b: Bucket) => void;
  currency: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const layout = barLayout(buckets, plotW, plotH);
  const empty = buckets.every((b) => b.income === 0 && b.expense === 0);
  const every = Math.max(1, Math.ceil(buckets.length / 8));
  const label = (b: TrendBucket) => bucketLabel(b.start, bucket);
  const text = (b: TrendBucket) =>
    `${label(b)}: income ${formatMoney(b.income, currency)}, spent ${formatMoney(b.expense, currency)}, net ${formatMoney(b.net, currency, { sign: "auto" })}`;
  const line = layout.bars
    .map(
      (g, i) =>
        `${i ? "L" : "M"} ${(PAD.l + g.cx).toFixed(1)} ${(PAD.t + g.netY).toFixed(1)}`,
    )
    .join(" ");
  const shown = active !== null ? buckets[active] : null;

  return (
    <section className="report-card" aria-labelledby="trend-title">
      <div className="report-card-head">
        <h2 id="trend-title">Income and spending</h2>
        <Segmented<Bucket>
          className="report-seg"
          label="Group by"
          value={bucket}
          onChange={onBucket}
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
        />
      </div>
      {empty ? (
        <Empty
          icon={<BarChartOutlined />}
          title="Nothing to chart"
          text="No income or spending in this range."
        />
      ) : (
        <>
          <ul className="trend-key" aria-hidden="true">
            <li>
              <i className="key-income" /> Income
            </li>
            <li>
              <i className="key-expense" /> Spent
            </li>
            <li>
              <i className="key-net" /> Net
            </li>
          </ul>
          <div className="trend-wrap">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="trend"
              role="group"
              aria-label={`Income and spending per ${bucket}. Use Tab to move between ${bucket}s.`}
              onMouseLeave={() => setActive(null)}
            >
              {layout.ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={PAD.l}
                    x2={W - PAD.r}
                    y1={PAD.t + layout.y(t)}
                    y2={PAD.t + layout.y(t)}
                    className={t === 0 ? "trend-zero" : "trend-grid"}
                  />
                  <text
                    x={PAD.l - 6}
                    y={PAD.t + layout.y(t) + 4}
                    textAnchor="end"
                    className="trend-axis"
                  >
                    {compactAmount(t)}
                  </text>
                </g>
              ))}
              {buckets.map((b, i) => {
                const g = layout.bars[i];
                return (
                  <g
                    key={b.start}
                    tabIndex={0}
                    role="img"
                    aria-label={text(b)}
                    className={
                      active === i ? "trend-bucket is-active" : "trend-bucket"
                    }
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                  >
                    <rect
                      x={PAD.l + g.cx - layout.slot / 2}
                      y={PAD.t}
                      width={layout.slot}
                      height={plotH}
                      className="trend-hit"
                    />
                    <rect
                      x={PAD.l + g.x}
                      y={PAD.t + g.incomeY}
                      width={g.width}
                      height={Math.max(g.incomeH, 0)}
                      className="bar-income"
                    />
                    <rect
                      x={PAD.l + g.cx + 1}
                      y={PAD.t + g.expenseY}
                      width={g.width}
                      height={Math.max(g.expenseH, 0)}
                      className="bar-expense"
                    />
                    {i % every === 0 && (
                      <text
                        x={PAD.l + g.cx}
                        y={H - 8}
                        textAnchor="middle"
                        className="trend-axis"
                      >
                        {label(b)}
                      </text>
                    )}
                  </g>
                );
              })}
              <path d={line} className="trend-net" />
              {layout.bars.map((g, i) => (
                <circle
                  key={i}
                  cx={PAD.l + g.cx}
                  cy={PAD.t + g.netY}
                  r={2.5}
                  className="trend-net-dot"
                />
              ))}
            </svg>
            <div className="trend-tip" role="status" aria-live="off">
              {shown ? text(shown) : "Hover or focus a bar for the figures."}
            </div>
          </div>
          <table className="sr-only">
            <caption>Income, spending and net per {bucket}</caption>
            <thead>
              <tr>
                <th>{bucket}</th>
                <th>Income</th>
                <th>Spent</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.start}>
                  <th scope="row">{label(b)}</th>
                  <td>{formatMoney(b.income, currency)}</td>
                  <td>{formatMoney(b.expense, currency)}</td>
                  <td>{formatMoney(b.net, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
