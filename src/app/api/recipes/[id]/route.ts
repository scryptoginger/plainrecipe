import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { toStoredRecipe, type RecipeRow } from "@/lib/recipe-record";
import { supabase } from "@/lib/supabase-server";

export const runtime = "nodejs";

function secretsMatch(provided: string, expected: string): boolean {
  const providedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/recipes/[id]">,
) {
  const { id } = await context.params;
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[recipes] get failed", error);
    return NextResponse.json({ error: "Could not load recipe." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  return NextResponse.json(toStoredRecipe(data as RecipeRow));
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/recipes/[id]">,
) {
  const provided = request.headers.get("x-admin-secret") ?? "";
  const expected = process.env.ADMIN_SECRET ?? "";
  if (!provided || !expected || !secretsMatch(provided, expected)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) {
    console.error("[recipes] delete failed", error);
    return NextResponse.json({ error: "Could not delete recipe." }, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
