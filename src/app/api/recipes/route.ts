import { NextResponse } from "next/server";

import { getClientIp } from "@/lib/client-ip";
import { condense } from "@/lib/condense";
import { extractRecipe } from "@/lib/extract";
import { toStoredRecipe, type RecipeRow } from "@/lib/recipe-record";
import { supabase } from "@/lib/supabase-server";
import { canonicalizeUrl } from "@/lib/url";

export const runtime = "nodejs";
export const maxDuration = 60;

async function findByCanonicalUrl(canonicalUrl: string) {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("canonical_url", canonicalUrl)
    .maybeSingle();
  if (error) throw error;
  return data ? toStoredRecipe(data as RecipeRow) : null;
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  let query = supabase.from("recipes").select("*").order("created_at", {
    ascending: false,
  });
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);

  const { data, error } = await query;
  if (error) {
    console.error("[recipes] list failed", error);
    return NextResponse.json({ error: "Could not load recipes." }, { status: 500 });
  }
  return NextResponse.json((data as RecipeRow[]).map(toStoredRecipe));
}

export async function POST(request: Request) {
  let url: string;
  let canonicalUrl: string;
  try {
    const body = (await request.json()) as { url?: unknown };
    if (typeof body.url !== "string" || !body.url.trim()) throw new Error("missing");
    url = body.url.trim();
    canonicalUrl = canonicalizeUrl(url);
  } catch {
    return NextResponse.json(
      { error: "Enter a valid HTTP or HTTPS recipe URL." },
      { status: 400 },
    );
  }

  try {
    const cached = await findByCanonicalUrl(canonicalUrl);
    if (cached) return NextResponse.json({ recipe: cached, cached: true });

    const ip = getClientIp(request);
    const configuredLimit = Number.parseInt(process.env.RATE_LIMIT_PER_DAY ?? "15", 10);
    const maxPerDay = Number.isFinite(configuredLimit) && configuredLimit > 0
      ? configuredLimit
      : 15;
    const { data: rateRows, error: rateError } = await supabase.rpc(
      "increment_rate_limit",
      { client_ip: ip, max_per_day: maxPerDay },
    );
    if (rateError) throw rateError;
    const rate = Array.isArray(rateRows) ? rateRows[0] : rateRows;
    if (!rate?.allowed) {
      return NextResponse.json(
        { error: "Daily recipe limit reached. Please try again tomorrow." },
        { status: 429 },
      );
    }

    const extracted = await extractRecipe(url);
    if (!extracted.ok) {
      console.warn(`[extract] ${extracted.reason}: ${url}`);
      const status = extracted.reason === "no_recipe" ? 422 : 502;
      return NextResponse.json(
        {
          error:
            extracted.reason === "no_recipe"
              ? "No structured recipe was found on that page."
              : "The recipe page could not be fetched.",
          reason: extracted.reason,
        },
        { status },
      );
    }

    const recipe = extracted.recipe;
    const summary = await condense({
      description: recipe.summary,
      title: recipe.title,
      ingredients: recipe.ingredients,
    });
    const { data, error } = await supabase
      .from("recipes")
      .insert({
        canonical_url: recipe.canonicalUrl,
        source_url: recipe.sourceUrl,
        title: recipe.title,
        summary,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        image_url: recipe.imageUrl,
        total_time: recipe.totalTime,
        recipe_yield: recipe.recipeYield,
        author: recipe.author,
        created_by_ip: ip,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        const raced = await findByCanonicalUrl(canonicalUrl);
        if (raced) return NextResponse.json({ recipe: raced, cached: true });
      }
      throw error;
    }

    return NextResponse.json(
      { recipe: toStoredRecipe(data as RecipeRow), cached: false },
      { status: 201 },
    );
  } catch (error) {
    console.error("[recipes] add failed", error);
    return NextResponse.json({ error: "Could not save this recipe." }, { status: 500 });
  }
}
