import "server-only";

import type { ExtractResult } from "@/lib/types";

// Fallback for sites with no JSON-LD (Cloudflare walls, JS-rendered recipes).
// NOT IMPLEMENTED this session. Logged failures tell us whether it is worth adding.
export async function extractViaBrowser(url: string): Promise<ExtractResult> {
  console.warn(`[extract] browser fallback not implemented for: ${url}`);
  return { ok: false, reason: "no_recipe", status: 501 };
}
