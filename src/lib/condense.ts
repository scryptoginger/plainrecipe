import "server-only";

import Anthropic from "@anthropic-ai/sdk";

type CondenseInput = {
  description: string | null;
  title: string;
  ingredients?: string[];
};

function isAlreadyShort(description: string): boolean {
  const sentences = description.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  return sentences.length <= 3 && description.length <= 500;
}

export async function condense({
  description,
  title,
  ingredients = [],
}: CondenseInput): Promise<string | null> {
  const cleanDescription = description?.replace(/\s+/g, " ").trim() || null;
  if (cleanDescription && isAlreadyShort(cleanDescription)) return cleanDescription;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const source = [
    `Recipe: ${title}`,
    cleanDescription ? `Source description: ${cleanDescription}` : null,
    ingredients.length
      ? `Ingredients for context: ${ingredients.slice(0, 20).join("; ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system:
        "Summarize into one short paragraph of only useful recipe context. No preamble, no life story, no marketing.",
      messages: [{ role: "user", content: source }],
    });
    const summary = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return summary || null;
  } catch (error) {
    console.error("[condense] Anthropic request failed", error);
    return null;
  }
}
