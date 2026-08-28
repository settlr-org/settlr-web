"use client";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileAddOutlined,
  MessageOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../../components/AppShell";
import {
  Empty,
  ErrorState,
  Loading,
  Panel,
  PanelTitle,
} from "../../../components/UI";
import { apiDownload, apiFetch } from "../../../lib/api";
import {
  Category,
  Expense,
  Group,
  Member,
  initials,
  money,
} from "../../../lib/types";
import { useSession } from "../../../components/SessionProvider";

type Comment = {
  id: string;
  user_id: string;
  name: string;
  body: string;
  created_at: string;
};
type Attachment = {
  id: string;
  user_id: string;
  file_url: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const [expense, setExpense] = useState<Expense>();
  const [group, setGroup] = useState<Group>();
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const e = await apiFetch<Expense>(`/api/v1/expenses/${id}`);
      const [g, m, c, cm, a] = await Promise.all([
        apiFetch<Group>(`/api/v1/groups/${e.group_id}`),
        apiFetch<{ data: Member[] }>(`/api/v1/groups/${e.group_id}/members`),
        apiFetch<{ data: Category[] }>("/api/v1/categories"),
        apiFetch<{ data: Comment[] }>(`/api/v1/expenses/${id}/comments`),
        apiFetch<{ data: Attachment[] }>(`/api/v1/expenses/${id}/attachments`),
      ]);
      setExpense(e);
      setGroup(g);
      setMembers(m.data);
      setCategories(c.data);
      setComments(cm.data);
      setAttachments(a.data);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not load expense.");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => void load(), [load]);
  const names = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m.name])),
    [members],
  );
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!expense) return;
    const data = new FormData(event.currentTarget);
    const splits = (expense.splits || []).map((split) => {
      const base = { user_id: split.user_id };
      const value = Number(data.get(`split-${split.user_id}`));
      if (expense.split_mode === "EXACT")
        return { ...base, amount: Math.round(value * 100) };
      if (expense.split_mode === "PERCENTAGE")
        return { ...base, percentage: value };
      if (expense.split_mode === "SHARES") return { ...base, shares: value };
      return base;
    });
    try {
      await apiFetch(`/api/v1/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          description: data.get("description"),
          amount: Math.round(Number(data.get("amount")) * 100),
          currency: expense.currency,
          paid_by: data.get("paid_by"),
          expense_date: data.get("expense_date"),
          category_id: data.get("category_id") || null,
          notes: data.get("notes"),
          split_mode: expense.split_mode,
          splits,
        }),
      });
      setSaved("Expense changes saved.");
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not save expense.");
    }
  };
  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form).get("body");
    try {
      await apiFetch(`/api/v1/expenses/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      form.reset();
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not add comment.");
    }
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    try {
      await apiFetch(`/api/v1/expenses/${id}/attachments`, {
        method: "POST",
        body,
      });
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not upload attachment.");
    }
    event.target.value = "";
  };
  const remove = async () => {
    if (!expense || !confirm(`Delete “${expense.description}”?`)) return;
    try {
      await apiFetch(`/api/v1/expenses/${id}`, { method: "DELETE" });
      router.replace(`/groups/${expense.group_id}`);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not delete expense.");
    }
  };
  if (loading || !expense || !group)
    return (
      <AppShell title="Expense" description="Loading expense details…">
        <Loading />
      </AppShell>
    );
  return (
    <AppShell
      title={expense.description}
      eyebrow={`${expense.split_mode} SPLIT`}
      description={`${money(expense.amount, expense.currency)} in ${group.name}`}
      actions={
        <button className="button danger" onClick={() => void remove()}>
          <DeleteOutlined /> Delete
        </button>
      }
    >
      <div className="detail-toolbar">
        <Link className="back-link" href={`/groups/${group.id}`}>
          <ArrowLeftOutlined /> Back to {group.name}
        </Link>
        <span className="status-pill">{expense.split_mode.toLowerCase()}</span>
      </div>
      {error && <ErrorState message={error} retry={load} />}{" "}
      {saved && <p className="success-note">{saved}</p>}
      <div className="management-grid">
        <Panel>
          <PanelTitle
            title="Expense details"
            meta="Edit the amount, payer, date, category, and split"
          />
          <form className="stack-form" onSubmit={save}>
            <label>
              Description
              <input
                name="description"
                defaultValue={expense.description}
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
                  defaultValue={expense.amount / 100}
                  required
                />
              </label>
              <label>
                Paid by
                <select name="paid_by" defaultValue={expense.paid_by}>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input
                  name="expense_date"
                  type="date"
                  defaultValue={expense.expense_date}
                />
              </label>
              <label>
                Category
                <select
                  name="category_id"
                  defaultValue={expense.category_id || ""}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {expense.split_mode !== "EQUAL" && (
              <fieldset>
                <legend>{expense.split_mode.toLowerCase()} values</legend>
                <div className="participant-list">
                  {expense.splits?.map((split) => (
                    <label key={split.user_id}>
                      {names[split.user_id] || "Member"}
                      <input
                        name={`split-${split.user_id}`}
                        type="number"
                        min="0"
                        step={expense.split_mode === "EXACT" ? ".01" : "1"}
                        defaultValue={
                          expense.split_mode === "EXACT"
                            ? (split.amount || 0) / 100
                            : expense.split_mode === "PERCENTAGE"
                              ? split.percentage
                              : split.shares
                        }
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <label>
              Notes
              <textarea name="notes" defaultValue={expense.notes} />
            </label>
            <button className="button primary">
              <SaveOutlined /> Save changes
            </button>
          </form>
        </Panel>
        <Panel>
          <PanelTitle
            title="Conversation"
            meta={`${comments.length} comments`}
            action={<MessageOutlined />}
          />
          <form className="inline-form" onSubmit={addComment}>
            <input
              name="body"
              required
              maxLength={2000}
              placeholder="Add context or ask a question"
            />
            <button className="button primary">Comment</button>
          </form>
          {comments.map((comment) => (
            <article className="comment-line" key={comment.id}>
              <span className="avatar soft">{initials(comment.name)}</span>
              <div>
                <strong>{comment.name}</strong>
                <p>{comment.body}</p>
                <small>{new Date(comment.created_at).toLocaleString()}</small>
              </div>
              {comment.user_id === user?.id && (
                <button
                  className="row-action"
                  aria-label="Delete comment"
                  onClick={() =>
                    confirm("Delete this comment?") &&
                    void apiFetch(`/api/v1/comments/${comment.id}`, {
                      method: "DELETE",
                    }).then(load)
                  }
                >
                  <DeleteOutlined />
                </button>
              )}
            </article>
          ))}
          {!comments.length && (
            <Empty text="Comments keep decisions attached to the expense." />
          )}
        </Panel>
        <Panel>
          <PanelTitle
            title="Receipts and files"
            meta="JPG, PNG, WebP, or PDF up to 5 MB"
            action={
              <label className="button file-button">
                <FileAddOutlined /> Add file
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={upload}
                />
              </label>
            }
          />
          {attachments.map((file) => (
            <article className="compact-line" key={file.id}>
              <FileAddOutlined />
              <div>
                <strong>{file.file_name}</strong>
                <small>{Math.ceil(file.size_bytes / 1024)} KB</small>
              </div>
              <button
                className="row-action"
                aria-label={`Download ${file.file_name}`}
                onClick={() => void apiDownload(file.file_url, file.file_name)}
              >
                <DownloadOutlined />
              </button>
              {file.user_id === user?.id && (
                <button
                  className="row-action"
                  aria-label={`Delete ${file.file_name}`}
                  onClick={() =>
                    confirm(`Delete ${file.file_name}?`) &&
                    void apiFetch(`/api/v1/attachments/${file.id}`, {
                      method: "DELETE",
                    }).then(load)
                  }
                >
                  <DeleteOutlined />
                </button>
              )}
            </article>
          ))}
          {!attachments.length && (
            <Empty text="Attach a receipt or document to this expense." />
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
