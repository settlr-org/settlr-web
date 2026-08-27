"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AppstoreOutlined,
  HomeOutlined,
  PlusOutlined,
  RightOutlined,
  RocketOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../components/AppShell";
import {
  Empty,
  ErrorState,
  Loading,
  Modal,
  Panel,
  PanelTitle,
} from "../../components/UI";
import { apiFetch } from "../../lib/api";
import { Balance, Group, money } from "../../lib/types";
export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [balance, setBalance] = useState<Balance>();
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, b] = await Promise.all([
        apiFetch<{ data: Group[] }>("/api/v1/groups"),
        apiFetch<Balance>("/api/v1/me/balances"),
      ]);
      setGroups(g.data);
      setBalance(b);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to load groups.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    if (new URLSearchParams(location.search).has("create")) setShow(true);
  }, [load]);
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      await apiFetch("/api/v1/groups", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          description: data.get("description"),
          currency: data.get("currency"),
          information: data.get("information"),
        }),
      });
      setShow(false);
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not create the group.");
    }
  };
  return (
    <AppShell
      title="Groups"
      eyebrow="SHARED LEDGERS"
      description="A home for every trip, household, event, and friendship."
      actions={
        <button className="button primary" onClick={() => setShow(true)}>
          <PlusOutlined /> New group
        </button>
      }
    >
      {loading ? (
        <Loading />
      ) : (
        <Panel>
          <PanelTitle
            title="Your groups"
            meta={`${groups.length} active ledgers`}
            action={
              <div className="filter-pills">
                <button className="active">Active</button>
                <button>Archived</button>
              </div>
            }
          />
          {error && <ErrorState message={error} retry={load} />}
          <div className="groups-list">
            {groups.map((g, i) => {
              const b = balance?.data.find((x) => x.group_id === g.id);
              const Icon =
                g.group_type === "HOME"
                  ? HomeOutlined
                  : g.group_type === "TRIP"
                    ? RocketOutlined
                    : i % 2
                      ? TeamOutlined
                      : AppstoreOutlined;
              return (
                <Link
                  href={`/groups/${g.id}`}
                  className="group-list-card"
                  key={g.id}
                >
                  <span className="group-cover">
                    <Icon />
                  </span>
                  <div>
                    <p>
                      {g.group_type || "GROUP"} · {g.currency}
                    </p>
                    <h2>{g.name}</h2>
                    <span>
                      {g.description || "A shared ledger for your group."}
                    </span>
                  </div>
                  <div className="group-position">
                    <small>YOUR POSITION</small>
                    <strong className={(b?.balance ?? 0) < 0 ? "negative" : ""}>
                      {money(b?.balance ?? 0, g.currency)}
                    </strong>
                  </div>
                  <RightOutlined />
                </Link>
              );
            })}
          </div>
          {!groups.length && (
            <Empty
              icon={<TeamOutlined />}
              title="No groups yet"
              text="Create your first shared ledger, then invite people and add expenses."
              action={
                <button
                  className="button primary"
                  onClick={() => setShow(true)}
                >
                  <PlusOutlined /> Create a group
                </button>
              }
            />
          )}
        </Panel>
      )}
      {show && (
        <Modal
          title="Create a new group"
          subtitle="Choose a clear name and currency. You can invite people next."
          onClose={() => setShow(false)}
        >
          <form onSubmit={create}>
            <label>
              Group name
              <input
                name="name"
                required
                maxLength={100}
                placeholder="Pokhara weekend"
              />
            </label>
            <label>
              Description
              <input name="description" placeholder="What is this group for?" />
            </label>
            <div className="form-grid">
              <label>
                Currency
                <select name="currency" defaultValue="NPR">
                  <option>NPR</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>INR</option>
                  <option>AUD</option>
                  <option>CAD</option>
                </select>
              </label>
              <label>
                Group type
                <select name="group_type" defaultValue="OTHER">
                  <option value="TRIP">Trip</option>
                  <option value="HOME">Home</option>
                  <option value="COUPLE">Couple</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
            </div>
            <label>
              Group information
              <textarea
                name="information"
                placeholder="House rules, payment details, or useful context"
              />
            </label>
            <button className="button primary full">Create group</button>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}
