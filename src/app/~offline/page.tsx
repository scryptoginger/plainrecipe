import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="offline">
      <span className="brand-mark">PR</span>
      <p className="eyebrow">You are offline</p>
      <h1>The kitchen shelf needs a connection.</h1>
      <p>Reconnect to clean a new page or load saved recipes.</p>
      <Link href="/">Try again</Link>
    </main>
  );
}
