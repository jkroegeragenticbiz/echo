import type { Embedder, GenerateObjectRequest, LlmProvider, LlmTask, Transcriber } from "./types";

export interface RecordedCall {
  task: LlmTask;
  schemaName: string;
  system: string;
  prompt: string;
  imageCount: number;
}

/**
 * Replays recorded model outputs in order, per task, and records every call
 * so tests can assert on prompts. Outputs are still validated by the schema,
 * exactly as the real provider's structured output would be.
 */
export class FixtureProvider implements LlmProvider {
  readonly name = "fixture";
  readonly calls: RecordedCall[] = [];
  private readonly queues: Map<LlmTask, unknown[]>;

  constructor(responses: Partial<Record<LlmTask, unknown[]>>) {
    this.queues = new Map(Object.entries(responses).map(([k, v]) => [k as LlmTask, [...(v ?? [])]]));
  }

  async generateObject<T>(req: GenerateObjectRequest<T>): Promise<T> {
    this.calls.push({
      task: req.task,
      schemaName: req.schemaName,
      system: req.system,
      prompt: req.prompt,
      imageCount: req.images?.length ?? 0,
    });
    const next = this.queues.get(req.task)?.shift();
    if (next === undefined) throw new Error(`FixtureProvider: no recorded response left for task "${req.task}"`);
    if (next instanceof Error) throw next;
    return req.schema.parse(next);
  }
}

/** Deterministic bag-of-words embedder: similar texts get similar vectors. */
export class FixtureEmbedder implements Embedder {
  readonly dimensions = 1536;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const v = new Array<number>(this.dimensions).fill(0);
      for (const word of text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []) {
        let h = 2166136261;
        for (const ch of word) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
        v[Math.abs(h) % this.dimensions]! += 1;
      }
      const norm = Math.hypot(...v) || 1;
      return v.map((x) => x / norm);
    });
  }
}

export class FixtureTranscriber implements Transcriber {
  constructor(private readonly transcript: string) {}
  async transcribe(): Promise<string> {
    return this.transcript;
  }
}
