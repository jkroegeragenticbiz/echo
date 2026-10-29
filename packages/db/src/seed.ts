import "dotenv/config";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { createDb, type Database } from "./client";
import { rewrites, saves, users, voiceProfiles } from "./schema";
import { DEMO_SAVES, DEMO_USER_EMAIL, DEMO_VOICES, canonicalizeUrl, normalizeForHash } from "./seed-data";

export type Embedder = (texts: string[]) => Promise<number[][]>;

/**
 * Idempotently (re)creates the demo user with 8 persona voices, 6 saves across
 * domains and their hand-written rewrites. Pass an embedder to fill embeddings.
 */
export async function seed(db: Database, opts: { embed?: Embedder } = {}) {
  await db.delete(users).where(eq(users.email, DEMO_USER_EMAIL));
  const [user] = await db
    .insert(users)
    .values({ email: DEMO_USER_EMAIL, name: "Demo User", plan: "plus" })
    .returning();
  if (!user) throw new Error("Failed to create demo user");

  const voiceRows = await db
    .insert(voiceProfiles)
    .values(
      DEMO_VOICES.map((v) => ({
        userId: user.id,
        name: v.name,
        personas: v.personas,
        description: v.description,
        perspective: v.perspective,
        tone: v.tone,
        isActive: v.isActive,
      })),
    )
    .returning();
  const voiceByPersona = new Map(voiceRows.map((row) => [row.personas[0]!, row]));

  const embeddings = opts.embed
    ? await opts.embed(DEMO_SAVES.map((s) => `${s.summary}\n\n${s.verbatim_text}`))
    : null;

  // Insert oldest first so the landing demo post is the newest card.
  const ordered = [...DEMO_SAVES].reverse();
  let rewriteCount = 0;
  for (const [i, demo] of ordered.entries()) {
    const createdAt = new Date(Date.now() - (ordered.length - i) * 36e5);
    const [save] = await db
      .insert(saves)
      .values({
        userId: user.id,
        platform: demo.platform,
        sourceUrl: demo.source_url,
        canonicalUrl: canonicalizeUrl(demo.source_url),
        author: demo.author,
        verbatimText: demo.verbatim_text,
        contentHash: createHash("sha256").update(normalizeForHash(demo.verbatim_text)).digest("hex"),
        domain: demo.domain,
        structured: demo.structured,
        summary: demo.summary,
        keyMetric: demo.key_metric,
        topics: demo.topics,
        embedding: embeddings?.[DEMO_SAVES.indexOf(demo)] ?? null,
        createdAt,
      })
      .returning();
    for (const [personaId, rw] of Object.entries(demo.rewrites)) {
      const voice = voiceByPersona.get(personaId);
      if (!voice || !rw) continue;
      await db.insert(rewrites).values({
        saveId: save!.id,
        voiceProfileId: voice.id,
        headline: rw.headline,
        paraphrase: rw.paraphrase,
        actionSteps: rw.action_steps,
      });
      rewriteCount++;
    }
  }

  return { userId: user.id, voices: voiceRows.length, saves: ordered.length, rewrites: rewriteCount };
}

async function openAiEmbedder(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small", input: texts }),
  });
  if (!res.ok) throw new Error(`Embedding request failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = createDb(url, { max: 1 });
  const result = await seed(db, { embed: process.env.OPENAI_API_KEY ? openAiEmbedder : undefined });
  console.info(
    `Seeded ${DEMO_USER_EMAIL}: ${result.voices} voices, ${result.saves} saves, ${result.rewrites} rewrites` +
      (process.env.OPENAI_API_KEY ? " (with embeddings)" : " (no OPENAI_API_KEY, embeddings skipped)"),
  );
  await db.$client.end();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
