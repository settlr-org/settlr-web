export type Expense = {
  icon: string;
  title: string;
  meta: string;
  amount: number;
  status: string;
  statusTone: "positive" | "negative";
};
export function BalanceCard({
  label,
  amount,
  detail,
  tone,
}: {
  label: string;
  amount: string;
  detail: string;
  tone: "positive" | "negative" | "neutral";
}) {
  return (
    <article className="balance-card">
      <span className="eyebrow">{label}</span>
      <strong className={`money money-${tone}`}>{amount}</strong>
      <span className="detail">{detail}</span>
    </article>
  );
}
export function ExpenseRow({
  icon,
  title,
  meta,
  amount,
  status,
  statusTone,
}: Expense) {
  return (
    <div className="expense-row">
      <div className="expense-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="expense-copy">
        <strong>{title}</strong>
        <span>{meta}</span>
      </div>
      <div className="expense-amount">
        <strong>{formatDisplay(amount)}</strong>
        <span className={`status-${statusTone}`}>{status}</span>
      </div>
    </div>
  );
}
function formatDisplay(amount: number) {
  return `NPR ${amount.toLocaleString("en-IN")}`;
}
