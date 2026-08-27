"use client";

import Link from "next/link";
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  PieChartOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { Brand } from "../components/Brand";
export default function Landing() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <Brand />
        <nav>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
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
      <section id="how" className="landing-section">
        <p className="eyebrow">ONE SHARED SOURCE OF TRUTH</p>
        <h2>From “I’ll pay you later” to settled.</h2>
        <div className="feature-grid">
          <article>
            <TeamOutlined />
            <span>01</span>
            <h3>Make a group</h3>
            <p>
              Bring everyone into one ledger for a home, trip, couple, or event.
            </p>
          </article>
          <article>
            <PieChartOutlined />
            <span>02</span>
            <h3>Add every expense</h3>
            <p>
              Split equally or use exact amounts, percentages, and custom
              shares.
            </p>
          </article>
          <article>
            <SafetyCertificateOutlined />
            <span>03</span>
            <h3>Settle clearly</h3>
            <p>
              Settlr simplifies the debt graph and shows the shortest path back
              to even.
            </p>
          </article>
        </div>
      </section>
      <footer className="landing-footer">
        <Brand />
        <p>Shared money, made clear.</p>
        <Link href="/register">
          Get started <ArrowRightOutlined />
        </Link>
      </footer>
    </main>
  );
}
