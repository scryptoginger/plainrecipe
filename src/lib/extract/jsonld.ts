import "server-only";

import * as cheerio from "cheerio";

import type { ExtractResult, Recipe } from "@/lib/types";

type JsonObject = Record<string, unknown>;

const REQUEST_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecipe(value: unknown): value is JsonObject {
  if (!isObject(value)) return false;
  const type = value["@type"];
  return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
}

function findRecipe(value: unknown): JsonObject | null {
  if (isRecipe(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipe(item);
      if (found) return found;
    }
  } else if (isObject(value) && Array.isArray(value["@graph"])) {
    return findRecipe(value["@graph"]);
  }
  return null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
}

function instructionsFrom(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map(asText)
      .filter((item): item is string => Boolean(item));
  }
  if (Array.isArray(value)) return value.flatMap(instructionsFrom);
  if (!isObject(value)) return [];

  const type = value["@type"];
  if (type === "HowToSection" || value.itemListElement) {
    const nested = instructionsFrom(value.itemListElement);
    if (nested.length) return nested;
  }
  const text = asText(value.text);
  return text ? [text] : [];
}

function imageFrom(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = imageFrom(item);
      if (image) return image;
    }
  }
  if (isObject(value)) return asText(value.url) ?? asText(value.contentUrl);
  return null;
}

function authorFrom(value: unknown): string | null {
  if (typeof value === "string") return asText(value);
  if (Array.isArray(value)) {
    return value.map(authorFrom).filter(Boolean).join(", ") || null;
  }
  return isObject(value) ? asText(value.name) : null;
}

export function formatDuration(value: unknown): string | null {
  const raw = asText(value);
  if (!raw) return null;
  const match = raw.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i,
  );
  if (!match) return raw;
  const parts: string[] = [];
  const labels = ["day", "hr", "min", "sec"];
  match.slice(1).forEach((amount, index) => {
    if (!amount || amount === "0") return;
    const label = labels[index];
    parts.push(`${amount} ${label}${label === "day" && amount !== "1" ? "s" : ""}`);
  });
  return parts.join(" ") || raw;
}

function yieldFrom(value: unknown): string | null {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ") || null;
  if (typeof value === "number") return String(value);
  return asText(value);
}

function toRecipe(data: JsonObject, sourceUrl: string): Recipe | null {
  const title = asText(data.name) ?? asText(data.headline);
  if (!title) return null;

  const ingredients = Array.isArray(data.recipeIngredient)
    ? data.recipeIngredient.map(asText).filter((item): item is string => Boolean(item))
    : [];

  return {
    title,
    summary: asText(data.description),
    ingredients,
    instructions: instructionsFrom(data.recipeInstructions),
    imageUrl: imageFrom(data.image),
    totalTime: formatDuration(data.totalTime),
    recipeYield: yieldFrom(data.recipeYield),
    author: authorFrom(data.author),
    sourceUrl,
    canonicalUrl: sourceUrl,
  };
}

export function parseJsonLdHtml(html: string, sourceUrl: string): Recipe | null {
  const $ = cheerio.load(html);
  for (const element of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(element).text().trim();
    if (!raw) continue;
    try {
      const found = findRecipe(JSON.parse(raw));
      if (found) return toRecipe(found, sourceUrl);
    } catch {
      // A malformed JSON-LD block should not hide valid blocks later in the page.
    }
  }
  return null;
}

export async function extractViaJsonLd(url: string): Promise<ExtractResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: REQUEST_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { ok: false, reason: "fetch_failed", status: 502 };
  }

  if (!response.ok) {
    const blocked = [401, 403, 407, 429].includes(response.status);
    return {
      ok: false,
      reason: blocked ? "blocked" : "fetch_failed",
      status: response.status,
    };
  }

  const recipe = parseJsonLdHtml(await response.text(), url);
  return recipe
    ? { ok: true, recipe, method: "jsonld" }
    : { ok: false, reason: "no_recipe", status: 422 };
}
