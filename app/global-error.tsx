"use client";
import "./theme.generated.css";
import "./globals.css";

// Replaces the root layout when it fails, so it brings its own <html>/<body>.
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="status-page" id="main">
          <p className="eyebrow">SOMETHING WENT WRONG</p>
          <h1>Settlr hit a problem</h1>
          <p className="status-copy">Your data is safe. Reload to try again.</p>
          <button
            className="button primary"
            type="button"
            onClick={() => retry()}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
