import type { StoredRecipe } from "@/lib/types";

export type RecipeRow = {
  id: string;
  canonical_url: string;
  source_url: string;
  title: string;
  summary: string | null;
  ingredients: string[];
  instructions: string[];
  image_url: string | null;
  total_time: string | null;
  recipe_yield: string | null;
  author: string | null;
  created_at: string;
};

export function toStoredRecipe(row: RecipeRow): StoredRecipe {
  return {
    id: row.id,
    canonicalUrl: row.canonical_url,
    sourceUrl: row.source_url,
    title: row.title,
    summary: row.summary,
    ingredients: row.ingredients,
    instructions: row.instructions,
    imageUrl: row.image_url,
    totalTime: row.total_time,
    recipeYield: row.recipe_yield,
    author: row.author,
    createdAt: row.created_at,
  };
}
