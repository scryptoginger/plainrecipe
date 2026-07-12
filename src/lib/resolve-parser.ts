const PINTEREST_HOST = /(^|\.)pinterest\.[a-z.]+$/;

export function isPinterestHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return normalized === "pin.it" || normalized === "pinterest.com" || PINTEREST_HOST.test(normalized);
}

function decodeCandidate(value: string): string {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`) as string;
  } catch {
    return value.replace(/\\\//g, "/").replace(/&amp;/g, "&");
  }
}

function usableOutbound(value: string): string | null {
  try {
    const candidate = decodeCandidate(value);
    const host = new URL(candidate).hostname.toLowerCase();
    if (!isPinterestHost(host) && !host.endsWith("pinimg.com")) return candidate;
  } catch {
    // Skip malformed and incomplete URLs.
  }
  return null;
}

/** Find a non-Pinterest destination in embedded pin JSON or page metadata. */
export function findOutboundLink(html: string): string | null {
  for (const match of html.matchAll(
    /"(?:link|source_url|canonical_url)":\s*"(https?:\\?\/\\?\/[^"\s]+)"/g,
  )) {
    const candidate = usableOutbound(match[1]);
    if (candidate) return candidate;
  }

  const metaPatterns = [
    /<meta[^>]+property=["']og:see_also["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:see_also["']/gi,
  ];
  for (const pattern of metaPatterns) {
    const match = pattern.exec(html);
    if (!match) continue;
    const candidate = usableOutbound(match[1].replace(/&amp;/g, "&"));
    if (candidate) return candidate;
  }
  return null;
}
