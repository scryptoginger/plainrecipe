import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

/**
 * Lazily-initialized Neon SQL client. Server-only.
 * Lazy so `next build` doesn't require DATABASE_URL to be present at build time,
 * while still failing loudly at request time if it's missing.
 */
export function db(): NeonQueryFunction<false, false> {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add your Neon connection string to the environment.",
      );
    }
    client = neon(connectionString);
  }
  return client;
}
