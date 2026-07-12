import "server-only";

import { findOutboundLink, isPinterestHost } from "@/lib/resolve-parser";

export { findOutboundLink } from "@/lib/resolve-parser";

const DESKTOP_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

const MOBILE_HEADERS = {
  ...DESKTOP_HEADERS,
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 " +
    "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
};

const SHORTENERS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "ow.ly",
  "buff.ly",
  "rebrand.ly",
  "shorturl.at",
]);

export type ResolveResult =
  | { ok: true; url: string }
  | { ok: false; reason: "pinterest_unresolved" };

async function fetchPage(
  url: string,
  headers: Record<string, string>,
  timeout: number,
): Promise<{ finalUrl: string; html: string } | null> {
  try {
    const response = await fetch(url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(timeout),
    });
    return {
      finalUrl: response.url || url,
      html: await response.text().catch(() => ""),
    };
  } catch {
    return null;
  }
}

function pinIdFrom(url: string): string | null {
  try {
    return new URL(url).pathname.match(/\/pin\/(\d+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function resolveSourceUrl(inputUrl: string): Promise<ResolveResult> {
  let host: string;
  try {
    host = new URL(inputUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return { ok: true, url: inputUrl };
  }

  const pinterestInput = isPinterestHost(host);
  if (!pinterestInput && !SHORTENERS.has(host)) return { ok: true, url: inputUrl };

  const first = await fetchPage(inputUrl, DESKTOP_HEADERS, 10_000);
  if (!first) {
    return pinterestInput
      ? { ok: false, reason: "pinterest_unresolved" }
      : { ok: true, url: inputUrl };
  }

  let finalHost: string;
  try {
    finalHost = new URL(first.finalUrl).hostname;
  } catch {
    return { ok: true, url: first.finalUrl };
  }
  if (!isPinterestHost(finalHost)) return { ok: true, url: first.finalUrl };

  const firstOutbound = findOutboundLink(first.html);
  if (firstOutbound) return { ok: true, url: firstOutbound };

  // Backups for Pinterest anti-bot/interstitial variants. Run together so the
  // resolver stays within the add route's 60-second execution budget.
  const retryHeaders = {
    ...DESKTOP_HEADERS,
    Referer: "https://www.pinterest.com/",
    "Cache-Control": "no-cache",
  };
  const pinId = pinIdFrom(first.finalUrl);
  const canonicalPinUrl = pinId
    ? `https://www.pinterest.com/pin/${pinId}/`
    : first.finalUrl;
  const retries = await Promise.all([
    fetchPage(first.finalUrl, retryHeaders, 7_000),
    fetchPage(canonicalPinUrl, MOBILE_HEADERS, 7_000),
  ]);

  for (const retry of retries) {
    if (!retry) continue;
    try {
      if (!isPinterestHost(new URL(retry.finalUrl).hostname)) {
        return { ok: true, url: retry.finalUrl };
      }
    } catch {
      // Keep checking the fetched body.
    }
    const outbound = findOutboundLink(retry.html);
    if (outbound) return { ok: true, url: outbound };
  }

  return { ok: false, reason: "pinterest_unresolved" };
}
