import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AnthropicProvider, createLlmProvider, LlmOutputError, LlmRefusalError, OpenAIEmbedder, WhisperTranscriber } from "../src/server/providers";
import { fakeFetch } from "./helpers";

type ParseParams = Record<string, unknown> & { output_config: { effort: string; format: unknown } };

/** Stands in for the SDK client; records the request and returns a canned response. */
function fakeClient(response: Record<string, unknown>) {
  const requests: ParseParams[] = [];
  const client = {
    beta: {
      messages: {
        parse: async (params: ParseParams) => {
          requests.push(params);
          return response;
        },
      },
    },
  } as unknown as Anthropic;
  return { client, requests };
}

const Schema = z.object({ answer: z.string() });

describe("AnthropicProvider", () => {
  it("sends structured-output requests with per-task model, effort and refusal fallback", async () => {
    const { client, requests } = fakeClient({ stop_reason: "end_turn", parsed_output: { answer: "ok" } });
    const provider = new AnthropicProvider({ apiKey: "k", client, models: { rewrite: "claude-sonnet-5-5" } });
    const out = await provider.generateObject({
      task: "rewrite",
      schemaName: "t",
      system: "sys",
      prompt: "hello",
      images: [{ kind: "url", url: "https://img.example/a.png" }],
      schema: Schema,
    });
    expect(out).toEqual({ answer: "ok" });
    const req = requests[0]!;
    expect(req.model).toBe("claude-sonnet-5-5");
    expect(req.system).toBe("sys");
    expect(req.output_config.effort).toBe("medium");
    expect(req.output_config.format).toBeTruthy();
    expect(req.fallbacks).toBe("default");
    expect(req.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(req.messages).toEqual([
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: "https://img.example/a.png" } },
          { type: "text", text: "hello" },
        ],
      },
    ]);
  });

  it("defaults every task to claude-opus-5-5 and classification to low effort", async () => {
    const { client, requests } = fakeClient({ stop_reason: "end_turn", parsed_output: { answer: "x" } });
    await new AnthropicProvider({ apiKey: "k", client }).generateObject({ task: "classify", schemaName: "c", system: "", prompt: "p", schema: Schema });
    expect(requests[0]!.model).toBe("claude-opus-5-5");
    expect(requests[0]!.output_config.effort).toBe("low");
  });

  it("surfaces refusals and unparseable output as typed errors", async () => {
    const refused = new AnthropicProvider({
      apiKey: "k",
      client: fakeClient({ stop_reason: "refusal", stop_details: { category: "cyber", explanation: "declined" }, parsed_output: null }).client,
    });
    const err = await refused.generateObject({ task: "rewrite", schemaName: "r", system: "", prompt: "p", schema: Schema }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmRefusalError);
    expect((err as LlmRefusalError).category).toBe("cyber");

    const truncated = new AnthropicProvider({ apiKey: "k", client: fakeClient({ stop_reason: "max_tokens", parsed_output: null }).client });
    await expect(truncated.generateObject({ task: "rewrite", schemaName: "r", system: "", prompt: "p", schema: Schema })).rejects.toThrow(LlmOutputError);
  });

  it("is selected from env and validates configuration", () => {
    expect(createLlmProvider({ LLM_PROVIDER: "anthropic", LLM_API_KEY: "k" }).name).toBe("anthropic");
    expect(() => createLlmProvider({ LLM_PROVIDER: "anthropic" })).toThrow(/LLM_API_KEY/);
    expect(() => createLlmProvider({ LLM_PROVIDER: "other", LLM_API_KEY: "k" })).toThrow(/Unknown LLM_PROVIDER/);
  });
});

describe("OpenAI embeddings and Whisper", () => {
  it("requests 1536-dim embeddings and returns them in input order", async () => {
    const { fetch, requests } = fakeFetch({
      "https://api.openai.com/v1/embeddings": {
        contentType: "application/json",
        body: JSON.stringify({ data: [{ index: 1, embedding: [2] }, { index: 0, embedding: [1] }] }),
      },
    });
    const out = await new OpenAIEmbedder("sk", "text-embedding-3-small", fetch).embed(["a", "b"]);
    expect(out).toEqual([[1], [2]]);
    expect(JSON.parse(requests[0]!.init!.body as string)).toEqual({ model: "text-embedding-3-small", input: ["a", "b"], dimensions: 1536 });
  });

  it("uploads audio as multipart form data", async () => {
    const { fetch, requests } = fakeFetch({ "https://api.openai.com/v1/audio/transcriptions": { body: " hello world \n", contentType: "text/plain" } });
    const text = await new WhisperTranscriber("sk", "whisper-1", fetch).transcribe(new Uint8Array([1, 2, 3]), "audio.mp3");
    expect(text).toBe("hello world");
    const form = requests[0]!.init!.body as FormData;
    expect(form.get("model")).toBe("whisper-1");
    expect((form.get("file") as File).name).toBe("audio.mp3");
  });
});
