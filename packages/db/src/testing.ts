import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import type { Database } from "./client";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Fresh in-memory Postgres (with pgvector) with all migrations applied. */
export async function createTestDb(): Promise<{ db: Database; close: () => Promise<void> }> {
  const client = new PGlite({ extensions: { vector } });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(here, "../drizzle") });
  return { db: db as unknown as Database, close: () => client.close() };
}

/** Deterministic unit vector pointing mostly along `axis`. */
export function fakeEmbedding(axis: number, wobble = 0): number[] {
  const v = new Array<number>(1536).fill(0);
  v[axis] = 1;
  v[(axis + 1) % 1536] = wobble;
  return v;
}
