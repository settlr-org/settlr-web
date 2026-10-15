"use client";
import { FormEvent, useState } from "react";
import { Modal } from "../../UI";
import { clearFilters, type ReportFilters } from "../../../lib/reports";
import {
  parseAmount,
  type Account,
  type Tag,
  type TxnType,
  type WalletCategory,
} from "../../../lib/wallet";

const TYPES: { value: TxnType; label: string }[] = [
  { value: "EXPENSE", label: "Expenses" },
  { value: "INCOME", label: "Income" },
  { value: "TRANSFER", label: "Transfers" },
];

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((v) => v !== id) : [...list, id];

function Checks({
  legend,
  items,
  selected,
  onToggle,
}: {
  legend: string;
  items: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset className="filter-group">
      <legend>{legend}</legend>
      {items.length === 0 ? (
        <p className="muted-copy">None yet.</p>
      ) : (
        <div className="filter-checks">
          {items.map((item) => (
            <label key={item.id} className="check-label">
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => onToggle(item.id)}
              />
              {item.name}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/** All report filters in one sheet; nothing applies until "Apply". */
export function FilterSheet({
  filters,
  accounts,
  categories,
  tags,
  onApply,
  onClose,
}: {
  filters: ReportFilters;
  accounts: Account[];
  categories: WalletCategory[];
  tags: Tag[];
  onApply: (next: ReportFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(filters);
  const [error, setError] = useState("");
  const set = (patch: Partial<ReportFilters>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const bad = (v: string) => v.trim() !== "" && (parseAmount(v) ?? -1) < 0;
    if (bad(draft.min) || bad(draft.max)) {
      setError("Enter amounts as plain numbers, like 12.50.");
      return;
    }
    if (
      draft.min &&
      draft.max &&
      (parseAmount(draft.min) ?? 0) > (parseAmount(draft.max) ?? 0)
    ) {
      setError("The minimum amount must not be above the maximum.");
      return;
    }
    onApply({
      ...draft,
      min: draft.min.trim(),
      max: draft.max.trim(),
      q: draft.q.trim(),
      exclQ: draft.exclQ.trim(),
    });
  };

  return (
    <Modal
      wide
      guardDirty={false}
      title="Filters"
      subtitle="Narrow the report. The same filters apply to the chart, the totals and the list."
      onClose={onClose}
    >
      <form className="filter-sheet" onSubmit={submit} noValidate>
        <fieldset className="filter-group">
          <legend>Type</legend>
          <div className="chip-row">
            {TYPES.map((t) => {
              const on = draft.types.includes(t.value);
              return (
                <button
                  key={t.value}
                  type="button"
                  className={on ? "chip active" : "chip"}
                  aria-pressed={on}
                  onClick={() =>
                    set({ types: toggle(draft.types, t.value) as TxnType[] })
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Checks
          legend="Accounts"
          items={accounts.map((a) => ({ id: a.id, name: a.name }))}
          selected={draft.accounts}
          onToggle={(id) => set({ accounts: toggle(draft.accounts, id) })}
        />
        <Checks
          legend="Categories"
          items={[
            { id: "none", name: "Uncategorized" },
            ...categories.map((c) => ({ id: c.id, name: c.name })),
          ]}
          selected={draft.categories}
          onToggle={(id) => set({ categories: toggle(draft.categories, id) })}
        />
        <Checks
          legend="Only with tags"
          items={tags.map((t) => ({ id: t.id, name: `#${t.name}` }))}
          selected={draft.tags}
          onToggle={(id) => set({ tags: toggle(draft.tags, id) })}
        />
        <Checks
          legend="Without tags"
          items={tags.map((t) => ({ id: t.id, name: `#${t.name}` }))}
          selected={draft.exclTags}
          onToggle={(id) => set({ exclTags: toggle(draft.exclTags, id) })}
        />
        <div className="form-grid">
          <label>
            Minimum amount
            <input
              inputMode="decimal"
              value={draft.min}
              onChange={(e) => set({ min: e.target.value })}
              placeholder="0.00"
            />
          </label>
          <label>
            Maximum amount
            <input
              inputMode="decimal"
              value={draft.max}
              onChange={(e) => set({ max: e.target.value })}
              placeholder="No limit"
            />
          </label>
          <label>
            Keywords (all must match)
            <input
              value={draft.q}
              maxLength={200}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="rent march"
            />
          </label>
          <label>
            Exclude keywords (any excludes)
            <input
              value={draft.exclQ}
              maxLength={200}
              onChange={(e) => set({ exclQ: e.target.value })}
              placeholder="refund"
            />
          </label>
        </div>
        <fieldset className="filter-group">
          <legend>Include</legend>
          <label className="check-label">
            <input
              type="checkbox"
              checked={draft.groupShares}
              onChange={(e) => set({ groupShares: e.target.checked })}
            />
            Group shares
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={draft.planned === "all"}
              onChange={(e) =>
                set({ planned: e.target.checked ? "all" : "false" })
              }
            />
            Planned (not yet paid)
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={draft.hideAdjustments}
              onChange={(e) => set({ hideAdjustments: e.target.checked })}
            />
            Hide adjustments (opening balances, corrections)
          </label>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button"
            onClick={() => setDraft(clearFilters(draft))}
          >
            Reset
          </button>
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">Apply filters</button>
        </div>
      </form>
    </Modal>
  );
}
