import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "../components/SessionProvider";

export const metadata: Metadata = {
  title: "Settlr | Shared money, settled clearly",
  description: "A calm place to keep shared spending balanced.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
