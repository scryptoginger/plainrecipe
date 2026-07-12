"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { StoredRecipe } from "@/lib/types";

const ADMIN_KEY = "plainrecipe-admin-secret";

async function errorMessage(response: Response, fallback: string) {
  try {
    return ((await response.json()) as { error?: string }).error || fallback;
  } catch { return fallback; }
}

export default function RecipeApp() {
  const [recipes, setRecipes] = useState<StoredRecipe[]>([]);
  const [selected, setSelected] = useState<StoredRecipe | null>(null);
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminSecret, setAdminSecret] = useState<string | null>(null);

  const loadRecipes = useCallback(async (search = "") => {
    setListLoading(true);
    try {
      const response = await fetch(`/api/recipes?q=${encodeURIComponent(search)}`);
      if (!response.ok) throw new Error(await errorMessage(response, "Could not load recipes."));
      setRecipes((await response.json()) as StoredRecipe[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load recipes.");
    } finally { setListLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAdminSecret(window.localStorage.getItem(ADMIN_KEY));
      void loadRecipes();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRecipes]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRecipes(query), 250);
    return () => window.clearTimeout(timer);
  }, [query, loadRecipes]);

  async function cleanRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(null);
    try {
      const response = await fetch("/api/recipes", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Could not clean recipe."));
      const { recipe } = (await response.json()) as { recipe: StoredRecipe };
      setSelected(recipe);
      setRecipes((current) => [recipe, ...current.filter((item) => item.id !== recipe.id)]);
      setUrl("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not clean recipe.");
    } finally { setLoading(false); }
  }

  function enableAdmin() {
    const secret = window.prompt("Enter the PlainRecipe admin secret");
    if (!secret) return;
    window.localStorage.setItem(ADMIN_KEY, secret); setAdminSecret(secret);
  }

  async function deleteRecipe(recipe: StoredRecipe) {
    if (!adminSecret || !window.confirm(`Delete “${recipe.title}”?`)) return;
    const response = await fetch(`/api/recipes/${recipe.id}`, {
      method: "DELETE", headers: { "x-admin-secret": adminSecret },
    });
    if (response.status === 403) {
      window.localStorage.removeItem(ADMIN_KEY); setAdminSecret(null);
      setError("That admin secret was not accepted. Admin mode has been cleared."); return;
    }
    if (!response.ok) { setError(await errorMessage(response, "Could not delete recipe.")); return; }
    setRecipes((current) => current.filter((item) => item.id !== recipe.id));
    if (selected?.id === recipe.id) setSelected(null);
  }

  return <main className="app-shell">
    <header className="masthead">
      <a className="brand" href="#top"><span className="brand-mark">PR</span><span>PlainRecipe</span></a>
      <p>Just the recipe. Nothing else.</p>
    </header>

    <section className="cleaner" id="top" aria-labelledby="cleaner-title">
      <div><span className="eyebrow">Recipe cleaner</span><h1 id="cleaner-title">Paste the page.<br />Keep the good part.</h1></div>
      <form className="url-form" onSubmit={cleanRecipe}>
        <label className="sr-only" htmlFor="recipe-url">Recipe URL</label>
        <input id="recipe-url" type="url" inputMode="url" placeholder="https://example.com/recipe" value={url} onChange={(e) => setUrl(e.target.value)} required />
        <button type="submit" disabled={loading}>{loading ? "Cleaning…" : "Clean it."}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
    </section>

    {selected && <RecipeView recipe={selected} />}

    <section className="library" aria-labelledby="saved-title">
      <div className="section-heading">
        <div><span className="eyebrow">Your kitchen shelf</span><h2 id="saved-title">Saved recipes</h2></div>
        <label className="search"><span className="sr-only">Search saved recipes</span><span aria-hidden="true">⌕</span>
          <input type="search" placeholder="Search by title" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      {listLoading ? <p className="quiet">Loading the shelf…</p> : recipes.length === 0 ?
        <div className="empty-state"><span>01</span><p>{query ? "No recipes match that search." : "Your cleaned recipes will wait here."}</p></div> :
        <div className="recipe-grid">{recipes.map((recipe, index) =>
          <article className="recipe-card" key={recipe.id}>
            <button className="card-main" onClick={() => setSelected(recipe)}>
              <span className="card-number">{String(index + 1).padStart(2, "0")}</span>
              <span><strong>{recipe.title}</strong><small>{[recipe.totalTime, recipe.recipeYield].filter(Boolean).join(" · ") || "Ready to cook"}</small></span>
              <span className="arrow" aria-hidden="true">↗</span>
            </button>
            {adminSecret && <button className="trash" onClick={() => void deleteRecipe(recipe)} aria-label={`Delete ${recipe.title}`} title="Delete recipe">×</button>}
          </article>)}</div>}
    </section>

    <footer><span>No ads. No background page loads.</span>{adminSecret ?
      <button onClick={() => { window.localStorage.removeItem(ADMIN_KEY); setAdminSecret(null); }}>Exit admin</button> :
      <button onClick={enableAdmin}>Admin mode</button>}</footer>
  </main>;
}

function RecipeView({ recipe }: { recipe: StoredRecipe }) {
  return <article className="recipe-view" aria-labelledby="recipe-title">
    <div className="recipe-intro"><div><span className="eyebrow">Cleaned recipe</span><h2 id="recipe-title">{recipe.title}</h2>
      <p className="byline">{[recipe.author && `By ${recipe.author}`, recipe.totalTime, recipe.recipeYield].filter(Boolean).join(" · ")}</p></div>
      <div className="recipe-actions">
        <button type="button" className="print-button" onClick={() => window.print()}>Print Recipe</button>
        <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="original">Open original ↗</a>
      </div></div>
    {recipe.summary && <p className="summary">{recipe.summary}</p>}
    {recipe.imageUrl && <img className="recipe-image" src={recipe.imageUrl} alt="" />}
    <div className="recipe-columns">
      <section><h3>Ingredients</h3><ul className="ingredients">{recipe.ingredients.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}</ul></section>
      <section><h3>Method</h3><ol className="instructions">{recipe.instructions.map((step, i) => <li key={`${step}-${i}`}>{step}</li>)}</ol></section>
    </div>
  </article>;
}
