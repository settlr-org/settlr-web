// Downloads offered in Settings → Account data.

export type ExportOption = {
  key: string;
  label: string;
  description: string;
  path: string;
  filename: string;
  primary?: boolean;
};

export const EXPORTS: ExportOption[] = [
  {
    key: "all",
    label: "All my data (JSON)",
    description:
      "A complete backup: wallet accounts, transactions, planned payments, budgets, loans, groups and settings.",
    path: "/api/v1/me/export.json",
    filename: "settlr-all-data.json",
    primary: true,
  },
  {
    key: "transactions",
    label: "Transactions (CSV)",
    description: "Every wallet transaction, including planned ones.",
    path: "/api/v1/me/export/transactions.csv",
    filename: "settlr-transactions.csv",
  },
  {
    key: "accounts",
    label: "Accounts (CSV)",
    description: "Your wallet accounts with currency and balance.",
    path: "/api/v1/me/export/accounts.csv",
    filename: "settlr-accounts.csv",
  },
  {
    key: "budgets",
    label: "Budgets (CSV)",
    description: "Your budgets and their limits.",
    path: "/api/v1/me/export/budgets.csv",
    filename: "settlr-budgets.csv",
  },
  {
    key: "loans",
    label: "Loans (CSV)",
    description: "Money you lent or borrowed, and what is left to settle.",
    path: "/api/v1/me/export/loans.csv",
    filename: "settlr-loans.csv",
  },
  {
    key: "groups",
    label: "Group expenses (CSV)",
    description: "Expenses and splits from your shared groups.",
    path: "/api/v1/me/export.csv",
    filename: "settlr-group-expenses.csv",
  },
];

/** Accept header for a download path. */
export const acceptFor = (path: string) =>
  path.endsWith(".json") ? "application/json" : "text/csv";
