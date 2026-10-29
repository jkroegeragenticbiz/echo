import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FixtureEmbedder, FixtureProvider, type LlmTask, type Transcriber } from "@echo/core/server";
import { users, type Database } from "@echo/db";
import type { ServiceContext } from "@/lib/services/context";

const here = path.dirname(fileURLToPath(import.meta.url));

export const fixture = (name: string) => readFileSync(path.join(here, "fixtures", name), "utf8");
export const llmFixture = (name: string) => JSON.parse(fixture(`${name}.json`)) as unknown;

export const lookup = async () => [{ address: "93.184.216.34" }];

export function fakeFetch(routes: Record<string, { status?: number; body: string | Uint8Array; contentType?: string }>) {
  const requests: { url: string; init?: RequestInit }[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    requests.push({ url, init });
    const key = Object.keys(routes).filter((p) => url.startsWith(p)).sort((a, b) => b.length - a.length)[0];
    if (!key) throw new Error(`Unexpected fetch in test: ${url}`);
    const r = routes[key]!;
    return new Response(r.body as BodyInit, { status: r.status ?? 200, headers: { "content-type": r.contentType ?? "text/html" } });
  }) as typeof fetch;
  return { fetch: impl, requests };
}

export interface TestContext extends ServiceContext {
  llm: FixtureProvider;
  /** Runs deferred `after()` work, including work it schedules, until idle. */
  flush(): Promise<void>;
}

export function makeContext(
  db: Database,
  opts: {
    responses?: Partial<Record<LlmTask, unknown[]>>;
    fetch?: typeof fetch;
    freeSavesPerMonth?: number;
    ffmpegPath?: string | null;
    transcriber?: Transcriber | null;
  } = {},
): TestContext {
  const llm = new FixtureProvider(opts.responses ?? {});
  const queue: (() => Promise<void>)[] = [];
  return {
    db,
    llm,
    async pipelineDeps() {
      return { llm, embedder: new FixtureEmbedder(), fetch: opts.fetch, lookup, x: null };
    },
    media: { ffmpegPath: opts.ffmpegPath ?? null, transcriber: opts.transcriber ?? null },
    defer(task) {
      queue.push(task);
    },
    config: { freeSavesPerMonth: opts.freeSavesPerMonth ?? 15, admobRewardedUnitId: "ca-app-pub-test/rewarded" },
    async flush() {
      while (queue.length) await queue.shift()!();
    },
  };
}

export async function createUser(db: Database, plan: "free" | "plus" = "free", email = `${crypto.randomUUID()}@test.dev`) {
  const [user] = await db.insert(users).values({ email, plan }).returning();
  return user!;
}
