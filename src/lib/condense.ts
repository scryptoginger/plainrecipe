import "server-only";

type CondenseInput = {
  description: string | null;
  title: string;
  ingredients?: string[];
};

// gemini-2.5-flash: stable, free-tier, good quality for short summaries.
// For more daily headroom you can switch to "gemini-2.5-flash-lite".
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_INSTRUCTION =
  "Summarize into one short paragraph of only useful recipe context. " +
  "No preamble, no life story, no marketing.";

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

  const apiKey = process.env.GEMINI_API_KEY;
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
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: source }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      console.error("[condense] Gemini request failed", response.status);
      return null;
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const summary = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return summary || null;
  } catch (error) {
    console.error("[condense] Gemini request error", error);
    return null;
  }
}
