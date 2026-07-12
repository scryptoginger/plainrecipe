import { NextResponse } from "next/server";

import { getClientIp } from "@/lib/client-ip";
import { condense } from "@/lib/condense";
import { db } from "@/lib/db";
import { extractRecipe } from "@/lib/extract";
import { toStoredRecipe, type RecipeRow } from "@/lib/recipe-record";
import { canonicalizeUrl } from "@/lib/url";

export const runtime = "nodejs";
export const maxDuration = 60;

async function findByCanonicalUrl(canonicalUrl: string) {
  const sql = db();
  const rows = (await sql`
    select * from recipes where canonical_url = ${canonicalUrl} limit 1
  `) as RecipeRow[];
  return rows[0] ? toStoredRecipe(rows[0]) : null;
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("q")?.trim();
  const q = raw ? raw.replace(/[%_]/g, "") : "";
  try {
    const sql = db();
    const rows = (q
      ? await sql`
          select * from recipes
          where title ilike ${"%" + q + "%"}
          order by created_at desc
        `
      : await sql`
          select * from recipes order by created_at desc
        `) as RecipeRow[];
    return NextResponse.json(rows.map(toStoredRecipe));
  } catch (error) {
    console.error("[recipes] list failed", error);
    return NextResponse.json({ error: "Could not load recipes." }, { status: 500 });
  }
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
    const sql = db();

    const cached = await findByCanonicalUrl(canonicalUrl);
    if (cached) return NextResponse.json({ recipe: cached, cached: true });

    const ip = getClientIp(request);
    const configuredLimit = Number.parseInt(process.env.RATE_LIMIT_PER_DAY ?? "15", 10);
    const maxPerDay =
      Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 15;

    const rateRows = (await sql`
      select * from increment_rate_limit(${ip}, ${maxPerDay})
    `) as { allowed: boolean; current_count: number }[];
    if (!rateRows[0]?.allowed) {
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

    try {
      const rows = (await sql`
        insert into recipes (
          canonical_url, source_url, title, summary,
          ingredients, instructions, image_url,
          total_time, recipe_yield, author, created_by_ip
        ) values (
          ${recipe.canonicalUrl}, ${recipe.sourceUrl}, ${recipe.title}, ${summary},
          ${JSON.stringify(recipe.ingredients)}::jsonb,
          ${JSON.stringify(recipe.instructions)}::jsonb,
          ${recipe.imageUrl}, ${recipe.totalTime}, ${recipe.recipeYield},
          ${recipe.author}, ${ip}
        )
        returning *
      `) as RecipeRow[];
      return NextResponse.json(
        { recipe: toStoredRecipe(rows[0]), cached: false },
        { status: 201 },
      );
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        const raced = await findByCanonicalUrl(canonicalUrl);
        if (raced) return NextResponse.json({ recipe: raced, cached: true });
      }
      throw error;
    }
  } catch (error) {
    console.error("[recipes] add failed", error);
    return NextResponse.json({ error: "Could not save this recipe." }, { status: 500 });
  }
}
