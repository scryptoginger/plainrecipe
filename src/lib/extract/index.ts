import "server-only";

import { canonicalizeUrl } from "@/lib/url";
import type { ExtractResult } from "@/lib/types";

import { extractViaBrowser } from "./browser";
import { extractViaJsonLd } from "./jsonld";

export async function extractRecipe(url: string): Promise<ExtractResult> {
  const canonicalUrl = canonicalizeUrl(url);
  const result = await extractViaJsonLd(url);

  if (!result.ok) {
    return result.reason === "no_recipe" ? extractViaBrowser(url) : result;
  }

  return {
    ...result,
    recipe: {
      ...result.recipe,
      sourceUrl: url,
      canonicalUrl,
    },
  };
}
