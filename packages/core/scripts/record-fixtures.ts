/**
 * Re-records the model-output fixtures under test/fixtures/llm/recorded/ by
 * running the real classifier and voice engine on the demo posts.
 * Tests never call this; run it by hand after changing prompts:
 *
 *   LLM_API_KEY=... pnpm --filter @echo/core record-fixtures
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_SAVES, getPersona } from "../src";
import { ClassifierOutputSchema, CLASSIFIER_SYSTEM, classifierPrompt, createLlmProvider, rewriteInVoice, type IngestedContent } from "../src/server";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "../test/fixtures/llm/recorded");

async function main() {
  const llm = createLlmProvider();
  await mkdir(out, { recursive: true });
  for (const demo of DEMO_SAVES) {
    const content: IngestedContent = {
      platform: demo.platform,
      sourceUrl: demo.source_url,
      canonicalUrl: demo.source_url,
      externalId: null,
      author: demo.author,
      verbatimText: demo.verbatim_text,
      mediaUrls: [],
      ocrText: null,
      transcript: null,
      needsMediaJob: false,
      via: "manual",
    };
    const classification = await llm.generateObject({
      task: "classify",
      schemaName: "classification",
      system: CLASSIFIER_SYSTEM,
      prompt: classifierPrompt(content, null),
      schema: ClassifierOutputSchema,
    });
    await writeFile(path.join(out, `classify-${demo.key}.json`), JSON.stringify(classification, null, 2) + "\n");

    const personaId = Object.keys(demo.rewrites)[0]!;
    const persona = getPersona(personaId)!;
    const rewrite = await rewriteInVoice(
      content,
      { structured: demo.structured, summary: demo.summary, key_metric: demo.key_metric, topics: demo.topics },
      { name: persona.label, personas: [persona.id], description: "", perspective: persona.defaultPerspective, tone: [...persona.defaultTone], voice_sample: null },
      llm,
    );
    await writeFile(path.join(out, `rewrite-${demo.key}-${personaId}.json`), JSON.stringify(rewrite, null, 2) + "\n");
    console.info(`Recorded ${demo.key}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
