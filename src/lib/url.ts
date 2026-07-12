const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "ref",
  "source",
  "mc_cid",
  "mc_eid",
]);

export function canonicalizeUrl(raw: string): string {
  const url = new URL(raw.trim());

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("Only HTTP and HTTPS recipe URLs are supported.");
  }

  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hash = "";

  const kept = [...url.searchParams.entries()]
    .filter(([key]) => {
      const normalized = key.toLowerCase();
      return !normalized.startsWith("utm_") && !TRACKING_PARAMS.has(normalized);
    })
    .sort(([keyA, valueA], [keyB, valueB]) =>
      keyA === keyB ? valueA.localeCompare(valueB) : keyA.localeCompare(keyB),
    );

  url.search = "";
  for (const [key, value] of kept) url.searchParams.append(key, value);

  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");

  return url.toString().replace(/\/$/, "");
}
