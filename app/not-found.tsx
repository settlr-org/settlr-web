import Link from "next/link";
import { Brand } from "../components/Brand";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="status-page" id="main">
      <Brand />
      <p className="eyebrow">ERROR 404</p>
      <h1>We couldn&apos;t find that page</h1>
      <p className="status-copy">
        The link may be out of date, or the page may have moved.
      </p>
      <div className="button-row">
        <Link className="button primary" href="/overview">
          Go to Home
        </Link>
        <Link className="button" href="/">
          Back to the start
        </Link>
      </div>
    </main>
  );
}
