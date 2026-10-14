"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../../components/AppShell";
import {
  ErrorState,
  Loading,
  Panel,
  PanelTitle,
  useConfirmation,
} from "../../../components/UI";
import {
  errorText,
  useWalletRefs,
  walletWrite,
} from "../../../components/wallet/data";
import { ItemTile } from "../../../components/wallet/icons";
import { StyleModal } from "../../../components/wallet/StyleModal";
import { moveItem, suggestColour, WalletCategory } from "../../../lib/wallet";

export default function CategoriesPage() {
  const requestConfirmation = useConfirmation();
  const { refs, error, setError, reload } = useWalletRefs();
  const [editing, setEditing] = useState<WalletCategory>();
  const [order, setOrder] = useState<WalletCategory[] | null>(null);
  const [notice, setNotice] = useState("");
  const categories = refs?.categories ?? [];
  const listed = order ?? categories;

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") || "").trim();
    if (!name) return;
    try {
      await walletWrite("/api/v1/categories", "POST", {
        name,
        icon: "tag",
        color: suggestColour(categories.length),
      });
      form.reset();
      setNotice(`Category “${name}” created.`);
      await reload();
    } catch (cause) {
      setError(errorText(cause, "Could not create the category."));
    }
  };

  const remove = async (category: WalletCategory) => {
    if (
      !(await requestConfirmation({
        title: `Delete “${category.name}”?`,
        description:
          "Transactions and group expenses using it become uncategorized.",
        confirmLabel: "Delete category",
        danger: true,
      }))
    )
      return;
    try {
      await walletWrite(`/api/v1/categories/${category.id}`, "DELETE");
      setNotice(`Category “${category.name}” deleted.`);
      await reload();
    } catch (cause) {
      setError(errorText(cause, "Could not delete the category."));
    }
  };

  const saveOrder = async () => {
    if (!order) return;
    try {
      await walletWrite("/api/v1/categories/reorder", "POST", {
        ids: order.map((c) => c.id),
      });
      setOrder(null);
      setNotice("Category order saved.");
      await reload();
    } catch (cause) {
      setError(errorText(cause, "Could not save the order."));
    }
  };

  return (
    <AppShell
      title="Categories"
      eyebrow="WALLET"
      description="Name, colour and order the categories you file money under."
    >
      <div className="detail-toolbar">
        <Link href="/wallet" className="back-link">
          <ArrowLeftOutlined /> Wallet
        </Link>
      </div>
      {error && <ErrorState message={error} retry={() => void reload()} />}
      {notice && (
        <div className="success-banner" role="status">
          {notice}
        </div>
      )}
      {!refs ? (
        <Loading />
      ) : (
        <Panel className="manage-panel">
          <PanelTitle
            title="All categories"
            meta={`${categories.filter((c) => !c.is_system).length} yours · ${categories.filter((c) => c.is_system).length} built in`}
            action={
              order ? undefined : (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setOrder(categories)}
                >
                  Reorder
                </button>
              )
            }
          />
          {!order && (
            <form className="inline-form manage-create" onSubmit={create}>
              <input
                name="name"
                required
                maxLength={100}
                placeholder="New category, e.g. Subscriptions"
                aria-label="New category name"
              />
              <button className="button primary">
                <PlusOutlined /> Add
              </button>
            </form>
          )}
          <ul className="manage-list">
            {listed.map((c, index) => (
              <li key={c.id} className="manage-row">
                <ItemTile icon={c.icon} color={c.color} />
                <span className="manage-name">
                  {order ? (
                    <strong>{c.name}</strong>
                  ) : (
                    <Link href={`/wallet/categories/${c.id}`}>
                      <strong>{c.name}</strong>
                    </Link>
                  )}
                  <small>
                    {c.is_system ? (
                      <>
                        <LockOutlined aria-hidden="true" /> Built in ·{" "}
                        {c.grouping}
                      </>
                    ) : (
                      "Yours"
                    )}
                  </small>
                </span>
                {order ? (
                  <span className="reorder-buttons">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Move ${c.name} up`}
                      disabled={index === 0}
                      onClick={() => setOrder(moveItem(order, index, -1))}
                    >
                      <ArrowUpOutlined />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Move ${c.name} down`}
                      disabled={index === order.length - 1}
                      onClick={() => setOrder(moveItem(order, index, 1))}
                    >
                      <ArrowDownOutlined />
                    </button>
                  </span>
                ) : c.is_system ? (
                  <span className="sr-only">
                    Built-in categories are locked
                  </span>
                ) : (
                  <span className="row-buttons">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Edit ${c.name}`}
                      onClick={() => setEditing(c)}
                    >
                      <EditOutlined />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Delete ${c.name}`}
                      onClick={() => void remove(c)}
                    >
                      <DeleteOutlined />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {order && (
            <div className="button-row panel-footer sticky-actions">
              <button
                type="button"
                className="button"
                onClick={() => setOrder(null)}
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
          )}
        </Panel>
      )}
      {editing && (
        <StyleModal
          kind="category"
          item={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async (name) => {
            setEditing(undefined);
            setNotice(`Category “${name}” saved.`);
            await reload();
          }}
        />
      )}
    </AppShell>
  );
}
