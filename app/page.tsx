'use client';

import { useMemo, useState } from 'react';
import { Brand } from '../components/Brand';
import { BalanceCard, ExpenseRow, type Expense } from '../components/Finance';
import { formatMoney } from '../lib/money';

const expenses: Expense[] = [
  { icon: '🍜', title: 'Dinner at Patan House', meta: 'Trip to Kathmandu · You paid', amount: 2400, status: 'You are owed NPR 1,600', statusTone: 'positive' },
  { icon: '🚕', title: 'Airport taxi', meta: 'Kathmandu weekend · Sita paid', amount: 1050, status: 'You owe NPR 350', statusTone: 'negative' },
  { icon: '🛒', title: 'Weekly groceries', meta: 'Flat 4B · You paid', amount: 3200, status: 'You are owed NPR 800', statusTone: 'positive' }
];

export default function Home() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showLogin, setShowLogin] = useState(false);
  const total = useMemo(() => expenses.reduce((sum, expense) => sum + expense.amount, 0), []);
  return <div className={`app theme-${theme}`}>
    <aside className="sidebar"><Brand /><nav aria-label="Primary navigation">{['Overview', 'Groups', 'Friends', 'Personal', 'Activity'].map((item, i) => <a className={i === 0 ? 'active' : ''} href={`#${item.toLowerCase()}`} key={item}><span aria-hidden="true">{['⌂', '◈', '◎', '◌', '↗'][i]}</span>{item}</a>)}</nav><div className="sidebar-bottom"><button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? '☾' : '☀'} {theme === 'light' ? 'Dark mode' : 'Light mode'}</button><button className="profile"><span className="avatar">NK</span><span><strong>Nabin</strong><small>Settings</small></span><span aria-hidden="true">⋯</span></button></div></aside>
    <main className="content"><header className="topbar"><div><p className="kicker">Thursday, 27 August</p><h1>Good evening, Nabin</h1></div><div className="top-actions"><button className="button button-ghost" onClick={() => setShowLogin(true)}>Sign in</button><button className="button button-primary">＋ Add expense</button></div></header>
      <section className="balance-grid" aria-label="Balance summary"><BalanceCard label="You owe" amount={formatMoney(1240)} detail="across 2 groups" tone="negative" /><BalanceCard label="You are owed" amount={formatMoney(3860)} detail="across 3 groups" tone="positive" /><BalanceCard label="Net balance" amount={formatMoney(2620, true)} detail="since your last settle up" tone="positive" /></section>
      <div className="content-grid"><section className="panel"><div className="panel-heading"><div><p className="kicker">Latest activity</p><h2>Keep things even</h2></div><button className="button button-quiet">View all</button></div><div className="expense-list">{expenses.map((expense) => <ExpenseRow key={expense.title} {...expense} />)}</div><p className="panel-foot">{formatMoney(total)} across your latest three expenses</p></section><section className="panel settle-panel"><p className="kicker">Next best action</p><h2>Settle with Sita</h2><p>Sita covered NPR 1,600 on your Kathmandu trip. A quick transfer will close the loop.</p><button className="button button-secondary">Review settlement <span>→</span></button><div className="settle-line"><span className="avatar avatar-small">S</span><span>Sita Sherpa</span><strong>NPR 1,600</strong></div></section></div>
      <section className="trust-row"><span>✓ Your data stays yours</span><span>✓ Integer-safe money</span><span>✓ Built for real groups</span></section>
    </main>
    {showLogin && <div className="modal-backdrop" role="presentation" onClick={() => setShowLogin(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowLogin(false)} aria-label="Close sign in">×</button><p className="kicker">Welcome back</p><h2 id="login-title">Keep your circle balanced</h2><p className="modal-copy">Sign in to see your real groups, balances, and recent activity.</p><label>Email<input type="email" placeholder="you@example.com" /></label><label>Password<input type="password" placeholder="••••••••" /></label><button className="button button-primary button-wide" onClick={() => setShowLogin(false)}>Sign in securely</button><p className="modal-note">Demo preview is available without an account.</p></section></div>}
  </div>;
}
