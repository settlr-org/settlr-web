"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  CalendarOutlined,
  FundOutlined,
  PlusOutlined,
  SwapOutlined,
  TagsOutlined,
  TransactionOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../components/AppShell";
import {
  Empty,
  ErrorState,
  Loading,
  Panel,
  PanelTitle,
} from "../../components/UI";
import { apiFetch } from "../../lib/api";
import {
  Account,
  buildLedgerQuery,
  formatMoney,
  moveItem,
  Overview,
  Period,
  periodContaining,
  TxnType,
} from "../../lib/wallet";
import {
  errorText,
  useWalletRefs,
  walletWrite,
} from "../../components/wallet/data";
import { WalletSummary } from "../../components/wallet/WalletSummary";
import { PeriodSelector } from "../../components/wallet/PeriodSelector";
import { HistoryPanel } from "../../components/wallet/HistoryPanel";
import { TransactionEditor } from "../../components/wallet/TransactionEditor";
import { AccountFormModal } from "../../components/wallet/AccountDialogs";
import { ItemTile } from "../../components/wallet/icons";
import { PlannedPanel } from "../../components/wallet/PlannedPanel";
import { BudgetsMini } from "../../components/wallet/BudgetsMini";

type EditorState = { id?: string; type?: TxnType; accountId?: string };

export default function WalletPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refs, error, setError, reload, updateSettings } = useWalletRefs();
  const [period, setPeriod] = useState<Period>();
  const [overview, setOverview] = useState<Overview>();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [newAccount, setNewAccount] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [reordering, setReordering] = useState<Account[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const startDay = refs?.settings.month_start_day ?? 1;
  useEffect(() => {
    if (refs && !period) setPeriod(periodContaining(new Date(), startDay));
  }, [refs, period, startDay]);

  useEffect(() => {
    if (!period) return;
    let cancelled = false;
    apiFetch<Overview>(`/api/v1/overview${buildLedgerQuery({ period })}`)
      .then((o) => !cancelled && setOverview(o))
      .catch((cause) => setError(errorText(cause, "Could not load totals.")));
    return () => {
      cancelled = true;
    };
  }, [period, reloadKey, setError]);

  // ?add=expense|income|transfer[&account=id] opens the editor (used by quick actions).
  useEffect(() => {
    const add = searchParams.get("add");
    if (!add || !refs) return;
    const type = add.toUpperCase();
    setEditor({
      type: (["INCOME", "EXPENSE", "TRANSFER"].includes(type)
        ? type
        : "EXPENSE") as TxnType,
      accountId: searchParams.get("account") || undefined,
    });
    router.replace("/wallet");
  }, [searchParams, refs, router]);

  const refresh = useCallback(
    async (message?: string) => {
      if (message) setNotice(message);
      await reload();
      setReloadKey((k) => k + 1);
    },
    [reload],
  );

  const saveOrder = async () => {
    if (!reordering) return;
    try {
      await walletWrite("/api/v1/accounts/reorder", "POST", {
        ids: reordering.map((a) => a.id),
      });
      setReordering(null);
      await refresh("Account order saved.");
    } catch (cause) {
      setError(errorText(cause, "Could not save the order."));
    }
  };

  const accounts = refs?.accounts ?? [];
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const hidden = refs?.settings.hide_balance ?? false;
  const listed = reordering ?? (showArchived ? accounts : active);

  return (
    <AppShell
      title="Wallet"
      eyebrow="YOUR MONEY"
      description="Your accounts, with group shares and settlements already counted."
      actions={
        <button
          className="button primary"
          aria-label="Add transaction"
          onClick={() => setEditor({ type: "EXPENSE" })}
          disabled={!refs}
        >
          <PlusOutlined /> Add transaction
        </button>
      }
    >
      {!refs || !period ? (
        error ? (
          <ErrorState message={error} retry={() => void reload()} />
        ) : (
          <Loading />
        )
      ) : (
        <>
          {error && <ErrorState message={error} retry={() => void refresh()} />}
          {notice && (
            <div className="success-banner" role="status">
              {notice}
            </div>
          )}
          <div className="wallet-toolbar">
            <PeriodSelector
              period={period}
              startDay={startDay}
              onChange={setPeriod}
            />
            <div className="button-row">
              <button
                type="button"
                className="button"
                onClick={() => setEditor({ type: "TRANSFER" })}
              >
                <SwapOutlined /> Transfer
              </button>
            </div>
          </div>
          <WalletSummary
            overview={overview}
            unavailable={Boolean(error) && !overview}
            settings={refs.settings}
            accountCount={active.filter((a) => a.include_in_balance).length}
            onToggleHidden={() =>
              void updateSettings({ hide_balance: !hidden })
            }
          />
          <div className="wallet-grid">
            <div className="wallet-side">
              <Panel className="accounts-panel">
                <PanelTitle
                  title="Accounts"
                  meta={`${active.length} active${archived.length ? ` · ${archived.length} archived` : ""}`}
                  action={
                    reordering ? undefined : (
                      <div className="button-row">
                        {accounts.length > 1 && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => setReordering(active)}
                          >
                            Reorder
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setNewAccount(true)}
                        >
                          <PlusOutlined /> New
                        </button>
                      </div>
                    )
                  }
                />
                {listed.length ? (
                  <ul className="account-list">
                    {listed.map((a, index) => {
                      const body = (
                        <>
                          <ItemTile icon={a.icon} color={a.color} />
                          <span className="account-name">
                            <strong>{a.name}</strong>
                            <small>
                              {[
                                a.currency,
                                a.is_default ? "default" : "",
                                a.include_in_balance ? "" : "not in total",
                                a.archived ? "archived" : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                          </span>
                          <span
                            className={
                              !hidden && a.balance < 0
                                ? "account-balance is-negative"
                                : "account-balance"
                            }
                          >
                            {formatMoney(a.balance, a.currency, { hidden })}
                            {(a.missing_rates ?? []).length > 0 && (
                              <WarningOutlined
                                className="missing-icon"
                                aria-label="Incomplete: an exchange rate is missing"
                                title="Incomplete: an exchange rate is missing"
                              />
                            )}
                          </span>
                        </>
                      );
                      return (
                        <li key={a.id}>
                          {reordering ? (
                            <div className="account-row">
                              {body}
                              <span className="reorder-buttons">
                                <button
                                  type="button"
                                  className="icon-button"
                                  aria-label={`Move ${a.name} up`}
                                  disabled={index === 0}
                                  onClick={() =>
                                    setReordering(
                                      moveItem(reordering, index, -1),
                                    )
                                  }
                                >
                                  <ArrowUpOutlined />
                                </button>
                                <button
                                  type="button"
                                  className="icon-button"
                                  aria-label={`Move ${a.name} down`}
                                  disabled={index === reordering.length - 1}
                                  onClick={() =>
                                    setReordering(
                                      moveItem(reordering, index, 1),
                                    )
                                  }
                                >
                                  <ArrowDownOutlined />
                                </button>
                              </span>
                            </div>
                          ) : (
                            <Link
                              href={`/wallet/accounts/${a.id}`}
                              className="account-row"
                            >
                              {body}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <Empty
                    title="No accounts yet"
                    text="Add your bank, cash or e-wallet to start tracking balances."
                    action={
                      <button
                        className="button primary"
                        onClick={() => setNewAccount(true)}
                      >
                        <PlusOutlined /> New account
                      </button>
                    }
                  />
                )}
                {reordering ? (
                  <div className="button-row panel-footer">
                    <button
                      type="button"
                      className="button"
                      onClick={() => setReordering(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="button primary"
                      onClick={() => void saveOrder()}
                    >
                      Save order
                    </button>
                  </div>
                ) : (
                  archived.length > 0 && (
                    <button
                      type="button"
                      className="text-button panel-footer"
                      aria-pressed={showArchived}
                      onClick={() => setShowArchived((v) => !v)}
                    >
                      {showArchived ? "Hide archived" : "Show archived"}
                    </button>
                  )
                )}
              </Panel>
              <BudgetsMini period={period} reloadKey={reloadKey} />
              <Panel className="wallet-links">
                <PanelTitle title="Plan & organise" />
                <Link href="/wallet/budgets" className="link-row">
                  <FundOutlined />{" "}
                  <span>
                    Budgets
                    <small>Limits per category and account</small>
                  </span>
                </Link>
                <Link href="/wallet/planned" className="link-row">
                  <CalendarOutlined />{" "}
                  <span>
                    Planned payments
                    <small>Rent, salary, subscriptions</small>
                  </span>
                </Link>
                <Link href="/wallet/loans" className="link-row">
                  <TransactionOutlined />{" "}
                  <span>
                    Loans
                    <small>Money lent or borrowed outside groups</small>
                  </span>
                </Link>
                <Link href="/wallet/categories" className="link-row">
                  <AppstoreOutlined /> <span>Categories</span>
                </Link>
                <Link href="/wallet/tags" className="link-row">
                  <TagsOutlined /> <span>Tags</span>
                </Link>
                <Link href="/personal" className="link-row">
                  <BarChartOutlined />{" "}
                  <span>
                    Personal stats &amp; export
                    <small>Monthly totals and CSV — until Wallet reports</small>
                  </span>
                </Link>
              </Panel>
            </div>
            <div className="wallet-main">
              <PlannedPanel
                upcoming={overview?.upcoming}
                overdue={overview?.overdue}
                periodEnd={period.to}
                accounts={accounts}
                categories={refs.categories}
                tags={refs.tags}
                baseCurrency={overview?.currency || "NPR"}
                onChanged={(message) => void refresh(message)}
              />
              <HistoryPanel
                accounts={accounts}
                categories={refs.categories}
                tags={refs.tags}
                period={period}
                reloadKey={reloadKey}
                onOpen={(entry) => setEditor({ id: entry.id })}
              />
            </div>
          </div>
          {editor && (
            <TransactionEditor
              key={editor.id ?? "new"}
              transactionId={editor.id}
              initialType={editor.type}
              initialAccountId={editor.accountId}
              accounts={accounts}
              categories={refs.categories}
              tags={refs.tags}
              baseCurrency={overview?.currency}
              onClose={() => setEditor(null)}
              onSaved={(message) => {
                setEditor(null);
                void refresh(message);
              }}
            />
          )}
          {newAccount && (
            <AccountFormModal
              count={accounts.length}
              baseCurrency={overview?.currency || "NPR"}
              onClose={() => setNewAccount(false)}
              onSaved={(a) => {
                setNewAccount(false);
                void refresh(`Account “${a.name}” created.`);
              }}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
