"use client";
import { formatMoney } from "../../../lib/wallet";

export type ByAccount = {
  account_id: string | null;
  name: string;
  currency: string;
  income: number;
  expense: number;
  net: number;
  base_income: number;
  base_expense: number;
  base_net: number;
};

/** Per-account totals in the account's own currency and in the base currency. */
export function ByAccountTable({
  rows,
  baseCurrency,
  hidden = false,
}: {
  rows: ByAccount[];
  baseCurrency: string;
  hidden?: boolean;
}) {
  if (!rows.length) return null;
  const money = (n: number, c: string) =>
    formatMoney(n, c, { sign: "auto", hidden });
  return (
    <details className="report-card by-account">
      <summary>By account</summary>
      <div className="ledger-wrap">
        <table className="ledger-table">
          <caption className="sr-only">Totals per account</caption>
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col" className="num">
                Income
              </th>
              <th scope="col" className="num">
                Spent
              </th>
              <th scope="col" className="num">
                Net
              </th>
              <th scope="col" className="num">
                Net ({baseCurrency})
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.account_id ?? "none"}>
                <th scope="row" className="ledger-title">
                  {r.name}
                  <small className="muted-copy"> {r.currency}</small>
                </th>
                <td className="num amount-in">{money(r.income, r.currency)}</td>
                <td className="num amount-out">
                  {formatMoney(r.expense, r.currency, { hidden })}
                </td>
                <td className="num">{money(r.net, r.currency)}</td>
                <td className="num">{money(r.base_net, baseCurrency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
