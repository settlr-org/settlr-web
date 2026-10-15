"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Brand } from "../components/Brand";

export default function ErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="status-page" id="main">
      <Brand />
      <p className="eyebrow">SOMETHING WENT WRONG</p>
      <h1>This page hit a problem</h1>
      <p className="status-copy">
        Your data is safe. Try again, or head back to Home.
      </p>
      <div className="button-row">
        <button
          className="button primary"
          type="button"
          onClick={() => retry()}
        >
          Try again
        </button>
        <Link className="button" href="/overview">
          Go to Home
        </Link>
      </div>
    </main>
  );
}
