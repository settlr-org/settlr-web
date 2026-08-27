import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Settlr | Shared money, settled clearly', description: 'A calm place to keep shared spending balanced.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
