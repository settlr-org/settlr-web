import type { Metadata } from "next";
import { DM_Mono, DM_Sans, Fraunces } from "next/font/google";
import "./theme.generated.css";
import "./globals.css";
import { SessionProvider } from "../components/SessionProvider";
import { WorkspaceLayout } from "../components/AppShell";
import { GoogleOAuthProvider } from "../components/GoogleOAuthProvider";

const sans = DM_Sans({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-dm-sans",
});
const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-fraunces",
});
const mono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Settlr | Shared money, settled clearly",
    template: "%s · Settlr",
  },
  description: "A calm place to keep shared spending balanced.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{const t=localStorage.getItem('settlr_theme');document.documentElement.dataset.theme=t||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{}",
          }}
        />
      </head>
      <body>
        <GoogleOAuthProvider>
          <SessionProvider>
            <WorkspaceLayout>{children}</WorkspaceLayout>
          </SessionProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
