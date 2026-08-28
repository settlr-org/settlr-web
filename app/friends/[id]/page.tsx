"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftOutlined,
  BankOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../../components/AppShell";
import { ErrorState, Loading, Panel, PanelTitle } from "../../../components/UI";
import { apiFetch } from "../../../lib/api";
import { initials } from "../../../lib/types";

type Person = { id: string; name: string; avatar_url?: string };
type Payment = {
  bank_qr_url: string;
  bank_name: string;
  payment_handle: string;
};
type Ledger = { group_id: string; title: string };
export default function FriendDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [person, setPerson] = useState<Person>();
  const [payment, setPayment] = useState<Payment>();
  const [ledger, setLedger] = useState<Ledger>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState(false);
  const load = useCallback(async () => {
    try {
      const p = await apiFetch<Person>(`/api/v1/users/${id}`);
      setPerson(p);
      const [l, pay] = await Promise.allSettled([
        apiFetch<Ledger>(`/api/v1/friends/${id}/ledger`),
        apiFetch<Payment>(`/api/v1/users/${id}/payment-info`),
      ]);
      if (l.status === "fulfilled") setLedger(l.value);
      if (pay.status === "fulfilled") setPayment(pay.value);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not load person.");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => void load(), [load]);
  const request = async () => {
    try {
      await apiFetch(`/api/v1/friends/${id}/request`, { method: "POST" });
      setRequested(true);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not send request.");
    }
  };
  const remove = async (block = false) => {
    if (!confirm(`${block ? "Block" : "Remove"} ${person?.name}?`)) return;
    try {
      await apiFetch(`/api/v1/friends/${id}${block ? "/block" : ""}`, {
        method: block ? "POST" : "DELETE",
      });
      router.replace("/friends");
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not update friendship.");
    }
  };
  if (loading || !person)
    return (
      <AppShell title="Person" description="Loading…">
        <Loading />
      </AppShell>
    );
  return (
    <AppShell
      title={person.name}
      eyebrow={ledger ? "CONNECTED FRIEND" : "SETTLR MEMBER"}
      description={
        ledger
          ? "Direct expenses, payment details, and friendship controls."
          : "Send a request to share a direct ledger."
      }
      actions={
        ledger ? (
          <Link className="button primary" href={`/groups/${ledger.group_id}`}>
            <TeamOutlined /> Open ledger
          </Link>
        ) : (
          <button
            className="button primary"
            disabled={requested}
            onClick={() => void request()}
          >
            <UserAddOutlined /> {requested ? "Request sent" : "Add friend"}
          </button>
        )
      }
    >
      <Link href="/friends" className="back-link">
        <ArrowLeftOutlined /> All friends
      </Link>
      {error && <ErrorState message={error} retry={load} />}
      <div className="friend-profile">
        <span className="avatar">{initials(person.name)}</span>
        <div>
          <strong>{person.name}</strong>
          <p>{ledger ? ledger.title : "Not connected yet"}</p>
        </div>
      </div>
      {ledger && (
        <div className="two-column">
          <Panel>
            <PanelTitle
              title="Payment details"
              meta="Use the method your friend has shared"
              action={<BankOutlined />}
            />
            {payment?.bank_name ||
            payment?.payment_handle ||
            payment?.bank_qr_url ? (
              <div className="payment-card">
                <span>Bank</span>
                <strong>{payment.bank_name || "Not provided"}</strong>
                <span>Payment handle</span>
                <strong>{payment.payment_handle || "Not provided"}</strong>
                {payment.bank_qr_url && (
                  <a
                    className="button"
                    href={payment.bank_qr_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open payment QR
                  </a>
                )}
              </div>
            ) : (
              <p className="muted-copy">No payment details shared yet.</p>
            )}
          </Panel>
          <Panel>
            <PanelTitle
              title="Friendship controls"
              meta="Direct-ledger history remains in financial records"
              action={<SafetyCertificateOutlined />}
            />
            <div className="stack-form">
              <button
                className="button danger"
                onClick={() => void remove(false)}
              >
                <DeleteOutlined /> Remove friend
              </button>
              <button
                className="button danger"
                onClick={() => void remove(true)}
              >
                <SafetyCertificateOutlined /> Block user
              </button>
            </div>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
