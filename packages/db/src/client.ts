import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

export type Schema = typeof schema;
/** Driver-agnostic handle: postgres-js in the app, PGlite in tests. */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

export function createDb(url: string, options: { max?: number } = {}) {
  // prepare:false keeps us compatible with Neon / pgbouncer transaction pooling.
  const client = postgres(url, { prepare: false, max: options.max ?? 5 });
  return drizzle(client, { schema });
}

const globalForDb = globalThis as unknown as { __echoDb?: ReturnType<typeof createDb> };

/** Lazily created, process-wide database handle (survives Next.js dev HMR). */
export function getDb(): Database {
  if (!globalForDb.__echoDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.__echoDb = createDb(url);
  }
  return globalForDb.__echoDb;
}
