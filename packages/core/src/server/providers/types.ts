import type { z } from "zod";

export type LlmTask = "classify" | "rewrite" | "vision_ocr";

export type LlmImage =
  | { kind: "base64"; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string }
  | { kind: "url"; url: string };

export interface GenerateObjectRequest<T> {
  task: LlmTask;
  system: string;
  prompt: string;
  images?: LlmImage[];
  schema: z.ZodType<T>;
  /** Short name used in logs and for the structured-output schema title. */
  schemaName: string;
}

/**
 * The one seam between Echo and a model vendor. Swap implementations with
 * LLM_PROVIDER; tests use FixtureProvider so they never hit the network.
 */
export interface LlmProvider {
  readonly name: string;
  generateObject<T>(req: GenerateObjectRequest<T>): Promise<T>;
}

export interface Embedder {
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export interface Transcriber {
  transcribe(audio: Uint8Array, filename: string): Promise<string>;
}

export class LlmRefusalError extends Error {
  constructor(
    message: string,
    readonly category: string | null,
  ) {
    super(message);
    this.name = "LlmRefusalError";
  }
}

export class LlmOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmOutputError";
  }
}
