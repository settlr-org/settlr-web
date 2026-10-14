"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../../components/AppShell";
import {
  Empty,
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
import { suggestColour, Tag } from "../../../lib/wallet";

export default function TagsPage() {
  const requestConfirmation = useConfirmation();
  const { refs, error, setError, reload } = useWalletRefs();
  const [editing, setEditing] = useState<Tag>();
  const [notice, setNotice] = useState("");
  const tags = refs?.tags ?? [];

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") || "").trim();
    if (!name) return;
    try {
      await walletWrite("/api/v1/tags", "POST", {
        name,
        color: suggestColour(tags.length),
        icon: "tag",
      });
      form.reset();
      setNotice(`Tag “${name}” created.`);
      await reload();
    } catch (cause) {
      setError(errorText(cause, "Could not create the tag."));
    }
  };

  const remove = async (tag: Tag) => {
    if (
      !(await requestConfirmation({
        title: `Delete “${tag.name}”?`,
        description: "It is removed from every transaction that uses it.",
        confirmLabel: "Delete tag",
        danger: true,
      }))
    )
      return;
    try {
      await walletWrite(`/api/v1/tags/${tag.id}`, "DELETE");
      setNotice(`Tag “${tag.name}” deleted.`);
      await reload();
    } catch (cause) {
      setError(errorText(cause, "Could not delete the tag."));
    }
  };

  return (
    <AppShell
      title="Tags"
      eyebrow="WALLET"
      description="Cross-cutting labels such as #trip or #work for any transaction."
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
          <PanelTitle title="Your tags" meta={`${tags.length} tags`} />
          <form className="inline-form manage-create" onSubmit={create}>
            <input
              name="name"
              required
              maxLength={50}
              placeholder="New tag, e.g. trip"
              aria-label="New tag name"
            />
            <button className="button primary">
              <PlusOutlined /> Add
            </button>
          </form>
          {tags.length ? (
            <ul className="manage-list">
              {tags.map((t) => (
                <li key={t.id} className="manage-row">
                  <ItemTile icon={t.icon || "tag"} color={t.color} />
                  <span className="manage-name">
                    <strong>#{t.name}</strong>
                  </span>
                  <span className="row-buttons">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Edit ${t.name}`}
                      onClick={() => setEditing(t)}
                    >
                      <EditOutlined />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Delete ${t.name}`}
                      onClick={() => void remove(t)}
                    >
                      <DeleteOutlined />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              icon={<TagsOutlined />}
              title="No tags yet"
              text="Tags group transactions across accounts and categories."
            />
          )}
        </Panel>
      )}
      {editing && (
        <StyleModal
          kind="tag"
          item={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async (name) => {
            setEditing(undefined);
            setNotice(`Tag “${name}” saved.`);
            await reload();
          }}
        />
      )}
    </AppShell>
  );
}
