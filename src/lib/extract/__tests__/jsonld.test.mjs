import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseJsonLdHtml } from "../jsonld.ts";

test("extracts ingredients and nested instructions from recipe JSON-LD", async () => {
  const fixture = await readFile(
    new URL("./fixtures/recipe.html", import.meta.url),
    "utf8",
  );
  const recipe = parseJsonLdHtml(fixture, "https://example.com/pasta");

  assert.ok(recipe);
  assert.equal(recipe.title, "Weeknight Tomato Pasta");
  assert.equal(recipe.totalTime, "45 min");
  assert.ok(recipe.ingredients.length > 0);
  assert.ok(recipe.instructions.length > 0);
  assert.match(recipe.instructions[0], /simmer the tomatoes/i);
});
