"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChartOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  TagOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../components/AppShell";
import { useSession } from "../../components/SessionProvider";
import {
  Empty,
  ErrorState,
  Loading,
  LoadError,
  Modal,
  Panel,
  PanelTitle,
} from "../../components/UI";
import { apiDownload, apiFetch } from "../../lib/api";
import { Category, PersonalExpense, money, todayISO } from "../../lib/types";
import theme from "../../theme/theme.json";
import { type LoadFailure, toLoadFailure } from "../../lib/errors";
import { plural } from "../../lib/format";
type Stats = {
  total: number;
  by_category:
    Record<string, number> | { category_id: string; total: number }[];
  by_month: { month: string; total: number }[];
};
type Budget = { month: string; amount: number; currency: string };
export default function Personal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expenses, setExpenses] = useState<PersonalExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<Stats>();
  const [budget, setBudget] = useState<Budget>();
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<PersonalExpense>();
  const [deleting, setDeleting] = useState<PersonalExpense>();
  const { user } = useSession();
  // Budget follows the saved budget, else the user's default currency (was hard-coded NPR).
  const budgetCurrency =
    (budget?.amount ? budget.currency : undefined) ||
    user?.default_currency ||
    "NPR";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);
  const month = new Date().toISOString().slice(0, 7);
  const openNewExpense = () => {
    setEditing(undefined);
    setShow(true);
  };
  const load = useCallback(async () => {
    try {
      setLoadFailure(null);
      const [e, c, s, b] = await Promise.all([
        apiFetch<{ data: PersonalExpense[] }>("/api/v1/personal/expenses"),
        apiFetch<{ data: Category[] }>("/api/v1/categories"),
        apiFetch<Stats>("/api/v1/personal/stats"),
        apiFetch<Budget>(`/api/v1/personal/budget?month=${month}`),
      ]);
      setExpenses(e.data);
      setCategories(c.data);
      setStats(s);
      setBudget(b);
    } catch (x) {
      setLoadFailure(toLoadFailure(x, "Unable to load personal spending."));
    } finally {
      setLoading(false);
    }
  }, [month]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setEditing(undefined);
    setShow(true);
    router.replace("/personal");
  }, [router, searchParams]);
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    try {
      await apiFetch(
        editing
          ? `/api/v1/personal/expenses/${editing.id}`
          : "/api/v1/personal/expenses",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({
            description: d.get("description"),
            amount: Math.round(Number(d.get("amount")) * 100),
            currency: d.get("currency"),
            category_id: d.get("category_id") || undefined,
            expense_date: d.get("expense_date"),
            notes: d.get("notes"),
          }),
        },
      );
      setShow(false);
      setEditing(undefined);
      await load();
    } catch (x) {
      setError(
        x instanceof Error ? x.message : "Could not save personal expense.",
      );
    }
  };
  const createCategory = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    try {
      await apiFetch("/api/v1/categories", {
        method: "POST",
        body: JSON.stringify({
          name: d.get("name"),
          icon: "tag",
          color: theme.modes.light.primary,
        }),
      });
      form.reset();
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not create category.");
    }
  };
  const removeExpense = async () => {
    if (!deleting) return;
    try {
      await apiFetch(`/api/v1/personal/expenses/${deleting.id}`, {
        method: "DELETE",
      });
      setDeleting(undefined);
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not delete expense.");
    }
  };
  const saveBudget = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    try {
      await apiFetch(`/api/v1/personal/budget?month=${month}`, {
        method: "PUT",
        body: JSON.stringify({
          amount: Math.round(Number(d.get("budget")) * 100),
          currency: budgetCurrency,
        }),
      });
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not save budget.");
    }
  };
  // "Spent this month": stats.total is all-time, so take this month's bucket.
  const spent =
    (Array.isArray(stats?.by_month)
      ? stats.by_month.find((m) => m.month === month)?.total
      : undefined) ??
    expenses
      .filter((e) => e.expense_date?.startsWith(month))
      .reduce((n, e) => n + e.amount, 0);
  const percent = budget?.amount
    ? Math.min(100, Math.round((spent / budget.amount) * 100))
    : 0;
  return (
    <AppShell
      title="Personal"
      eyebrow="JUST FOR YOU"
      description="Private spending, monthly budgets, and trends outside your groups."
      actions={
        <button
          className="button primary"
          onClick={() => {
            openNewExpense();
          }}
        >
          <PlusOutlined /> Add personal expense
        </button>
      }
    >
      {loading ? (
        <Loading />
      ) : loadFailure ? (
        <LoadError
          failure={loadFailure}
          retry={load}
          backHref="/wallet"
          backLabel="Back to wallet"
        />
      ) : (
        <>
          {error && <ErrorState message={error} retry={load} />}
          <div className="success-note moved-note" role="note">
            Personal expenses now live in your{" "}
            <Link href="/wallet">Wallet</Link> as expense transactions (on your
            default account), and budgets with categories and accounts are in{" "}
            <Link href="/wallet/budgets">Wallet → Budgets</Link>. This page
            keeps the legacy monthly budget, stats and CSV export until Wallet
            reports arrive.
          </div>
          <button
            className="button primary mobile-personal-add"
            onClick={openNewExpense}
          >
            <PlusOutlined /> Add personal expense
          </button>
          <section className="personal-summary">
            <article>
              <span>
                <WalletOutlined />
              </span>
              <p>SPENT THIS MONTH</p>
              <strong>{money(spent, budgetCurrency)}</strong>
              <small>{plural(expenses.length, "expense")}</small>
            </article>
            <article>
              <span>
                <BarChartOutlined />
              </span>
              <p>MONTHLY BUDGET</p>
              <strong>{money(budget?.amount ?? 0, budgetCurrency)}</strong>
              <div className="progress">
                <i style={{ width: `${percent}%` }} />
              </div>
              <small>{percent}% used</small>
            </article>
          </section>
          <div className="dashboard-grid">
            <Panel>
              <PanelTitle
                title="Recent personal expenses"
                meta={`${plural(expenses.length, "entry", "entries")}`}
                action={
                  <button
                    className="text-button"
                    onClick={() =>
                      void apiDownload(
                        "/api/v1/personal/export.csv",
                        "settlr-personal-expenses.csv",
                      )
                    }
                  >
                    <DownloadOutlined /> Export CSV
                  </button>
                }
              />
              {expenses.map((e) => (
                <article className="expense-line" key={e.id}>
                  <span className="expense-category">
                    <WalletOutlined />
                  </span>
                  <div>
                    <h3>
                      {e.description ||
                        categories.find((c) => c.id === e.category_id)?.name ||
                        "Untitled expense"}
                    </h3>
                    <p>
                      {new Date(e.expense_date).toLocaleDateString()} ·{" "}
                      {categories.find((c) => c.id === e.category_id)?.name ||
                        "Uncategorized"}
                    </p>
                  </div>
                  <strong>{money(e.amount, e.currency)}</strong>
                  <button
                    className="row-action"
                    aria-label={`Edit ${e.description}`}
                    onClick={() => {
                      setEditing(e);
                      setShow(true);
                    }}
                  >
                    <EditOutlined />
                  </button>
                  <button
                    className="row-action"
                    aria-label={`Delete ${e.description}`}
                    onClick={() => setDeleting(e)}
                  >
                    <DeleteOutlined />
                  </button>
                </article>
              ))}
              {!expenses.length && (
                <Empty text="Track a private expense without adding it to a shared group." />
              )}
            </Panel>
            <Panel>
              <PanelTitle title="Budget" meta={month} />
              <form className="budget-form" onSubmit={saveBudget}>
                <label>
                  Monthly limit
                  <div className="amount-field">
                    <span>{budgetCurrency}</span>
                    <input
                      name="budget"
                      type="number"
                      min="0"
                      step=".01"
                      defaultValue={(budget?.amount ?? 0) / 100}
                    />
                  </div>
                </label>
                <button className="button primary full">Update budget</button>
              </form>
              <hr className="panel-rule" />
              <PanelTitle
                title="Categories"
                meta="Create a private spending label"
                action={<TagOutlined />}
              />
              <form className="inline-form" onSubmit={createCategory}>
                <input
                  name="name"
                  required
                  placeholder="e.g. Subscriptions"
                  aria-label="Category name"
                />
                <button className="button">Add</button>
              </form>
            </Panel>
          </div>
        </>
      )}
      {show && (
        <Modal
          title={editing ? "Edit personal expense" : "Add a personal expense"}
          subtitle="Only you can see personal expenses."
          onClose={() => {
            setShow(false);
            setEditing(undefined);
          }}
        >
          <form onSubmit={create}>
            <label>
              Description
              <input
                name="description"
                defaultValue={editing?.description}
                required
              />
            </label>
            <div className="form-grid">
              <label>
                Amount
                <input
                  name="amount"
                  type="number"
                  min=".01"
                  step=".01"
                  required
                  defaultValue={editing ? editing.amount / 100 : undefined}
                />
              </label>
              <label>
                Currency
                <select
                  name="currency"
                  defaultValue={
                    editing?.currency || user?.default_currency || "NPR"
                  }
                >
                  <option>NPR</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>INR</option>
                  <option>GBP</option>
                  <option>AUD</option>
                  <option>CAD</option>
                </select>
              </label>
              <label>
                Category
                <select
                  name="category_id"
                  defaultValue={editing?.category_id || ""}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input
                  name="expense_date"
                  type="date"
                  defaultValue={editing?.expense_date || todayISO()}
                />
              </label>
            </div>
            <label>
              Notes
              <textarea name="notes" defaultValue={editing?.notes} />
            </label>
            <button className="button primary full">
              {editing ? "Save changes" : "Save personal expense"}
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete personal expense?"
          subtitle={`“${deleting.description}” will be permanently removed from your private ledger.`}
          onClose={() => setDeleting(undefined)}
        >
          <div className="modal-actions">
            <button
              className="button full"
              onClick={() => setDeleting(undefined)}
            >
              Keep expense
            </button>
            <button
              className="button danger full"
              onClick={() => void removeExpense()}
            >
              <DeleteOutlined /> Delete expense
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
