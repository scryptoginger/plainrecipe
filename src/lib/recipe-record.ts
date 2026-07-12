import type { StoredRecipe } from "@/lib/types";

export type RecipeRow = {
  id: string;
  canonical_url: string;
  source_url: string;
  title: string;
  summary: string | null;
  ingredients: unknown; // jsonb — may arrive as array or JSON string
  instructions: unknown; // jsonb — may arrive as array or JSON string
  image_url: string | null;
  total_time: string | null;
  recipe_yield: string | null;
  author: string | null;
  created_at: string;
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function toStoredRecipe(row: RecipeRow): StoredRecipe {
  return {
    id: row.id,
    canonicalUrl: row.canonical_url,
    sourceUrl: row.source_url,
    title: row.title,
    summary: row.summary,
    ingredients: asStringArray(row.ingredients),
    instructions: asStringArray(row.instructions),
    imageUrl: row.image_url,
    totalTime: row.total_time,
    recipeYield: row.recipe_yield,
    author: row.author,
    createdAt: row.created_at,
  };
}
