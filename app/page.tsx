"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { Brand } from "../components/Brand";
import { useSession } from "../components/SessionProvider";
export default function Landing() {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/overview");
  }, [router, user]);

  if (loading || user) {
    return (
      <main className="landing" aria-busy="true">
        <p className="landing-redirect">Opening your workspace…</p>
      </main>
    );
  }

  return (
    <main className="landing">
      <header className="landing-nav">
        <Brand />
        <nav>
          <Link href="/login">Sign in</Link>
          <Link className="button primary" href="/register">
            Start settling
          </Link>
        </nav>
      </header>
      <section className="landing-hero">
        <div>
          <p className="eyebrow">SHARED MONEY WITHOUT THE AWKWARDNESS</p>
          <h1>
            Keep the memories.
            <br />
            <em>Split the maths.</em>
          </h1>
          <p>
            Track group expenses, see exactly who owes whom, and settle up
            without spreadsheets or uncomfortable reminders.
          </p>
          <div className="hero-actions">
            <Link href="/register" className="button primary">
              Create a free account <ArrowRightOutlined />
            </Link>
            <Link href="/login" className="button">
              I already use Settlr
            </Link>
          </div>
          <div className="trust-row">
            <span>
              <CheckCircleOutlined /> Free to use
            </span>
            <span>
              <CheckCircleOutlined /> Exact-cent splits
            </span>
            <span>
              <CheckCircleOutlined /> Multi-currency
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-card visual-main">
            <span className="visual-label">POKHARA WEEKEND</span>
            <strong>NPR 12,480</strong>
            <p>Group spending this trip</p>
            <div className="visual-members">
              <i>NK</i>
              <i>AS</i>
              <i>MR</i>
              <span>3 friends</span>
            </div>
          </div>
          <div className="visual-card visual-float">
            <WalletOutlined />
            <div>
              <span>You are owed</span>
              <strong>NPR 3,240</strong>
            </div>
          </div>
          <div className="visual-orbit" />
        </div>
      </section>
      <footer className="landing-footer">
        <Brand />
        <p>Shared money, made clear.</p>
      </footer>
    </main>
  );
}
