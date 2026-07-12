export type Recipe = {
  title: string;
  summary: string | null;
  ingredients: string[];
  instructions: string[];
  imageUrl: string | null;
  totalTime: string | null;
  recipeYield: string | null;
  author: string | null;
  sourceUrl: string;
  canonicalUrl: string;
};

export type ExtractResult =
  | { ok: true; recipe: Recipe; method: "jsonld" | "browser" }
  | {
      ok: false;
      reason: "no_recipe" | "fetch_failed" | "blocked";
      status: number;
    };

export type StoredRecipe = Recipe & {
  id: string;
  createdAt: string;
};
