import type { Embedder, Transcriber } from "./types";

/** OpenAI embeddings (text-embedding-3-small = 1536 dims, matching saves.embedding). */
export class OpenAIEmbedder implements Embedder {
  readonly dimensions = 1536;

  constructor(
    private readonly apiKey: string,
    private readonly model = "text-embedding-3-small",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await this.fetchImpl("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, input: texts, dimensions: this.dimensions }),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

/** Whisper transcription via the OpenAI audio API. */
export class WhisperTranscriber implements Transcriber {
  constructor(
    private readonly apiKey: string,
    private readonly model = "whisper-1",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async transcribe(audio: Uint8Array, filename: string): Promise<string> {
    const form = new FormData();
    form.append("model", this.model);
    form.append("response_format", "text");
    form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), filename);
    const res = await this.fetchImpl("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Whisper transcription failed: ${res.status} ${await res.text()}`);
    return (await res.text()).trim();
  }
}
