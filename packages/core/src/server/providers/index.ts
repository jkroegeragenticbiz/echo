import { AnthropicProvider } from "./anthropic";
import { OpenAIEmbedder, WhisperTranscriber } from "./openai";
import type { Embedder, LlmProvider, Transcriber } from "./types";

export * from "./types";
export * from "./anthropic";
export * from "./openai";
export * from "./fixture";

type Env = Record<string, string | undefined>;

/** Builds the configured LLM provider from env (LLM_PROVIDER, LLM_API_KEY, LLM_MODEL_*). */
export function createLlmProvider(env: Env = process.env): LlmProvider {
  const provider = env.LLM_PROVIDER ?? "anthropic";
  const apiKey = env.LLM_API_KEY;
  switch (provider) {
    case "anthropic":
      if (!apiKey) throw new Error("LLM_API_KEY is not set");
      return new AnthropicProvider({
        apiKey,
        models: {
          classify: env.LLM_MODEL_CLASSIFY || undefined,
          rewrite: env.LLM_MODEL_REWRITE || undefined,
          vision_ocr: env.LLM_MODEL_VISION || undefined,
        },
      });
    default:
      throw new Error(`Unknown LLM_PROVIDER "${provider}". Implement LlmProvider and register it here.`);
  }
}

export function createEmbedder(env: Env = process.env): Embedder | null {
  return env.OPENAI_API_KEY ? new OpenAIEmbedder(env.OPENAI_API_KEY, env.EMBEDDING_MODEL || undefined) : null;
}

export function createTranscriber(env: Env = process.env): Transcriber | null {
  return env.OPENAI_API_KEY ? new WhisperTranscriber(env.OPENAI_API_KEY, env.WHISPER_MODEL || undefined) : null;
}
