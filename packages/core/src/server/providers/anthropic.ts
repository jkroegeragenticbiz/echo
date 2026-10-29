import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import {
  LlmOutputError,
  LlmRefusalError,
  type GenerateObjectRequest,
  type LlmImage,
  type LlmProvider,
  type LlmTask,
} from "./types";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

export interface AnthropicProviderOptions {
  apiKey: string;
  models?: Partial<Record<LlmTask, string>>;
  /** Injected in tests; defaults to a real SDK client. */
  client?: Anthropic;
}

/**
 * Effort per task: extraction and OCR are routine; rewriting in someone's
 * voice benefits from a bit more thought.
 */
const EFFORT: Record<LlmTask, "low" | "medium" | "high"> = {
  classify: "low",
  vision_ocr: "low",
  rewrite: "medium",
};

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  private readonly models: Record<LlmTask, string>;

  constructor(opts: AnthropicProviderOptions) {
    this.client = opts.client ?? new Anthropic({ apiKey: opts.apiKey, maxRetries: 2, timeout: 120_000 });
    this.models = {
      classify: opts.models?.classify ?? DEFAULT_ANTHROPIC_MODEL,
      rewrite: opts.models?.rewrite ?? DEFAULT_ANTHROPIC_MODEL,
      vision_ocr: opts.models?.vision_ocr ?? DEFAULT_ANTHROPIC_MODEL,
    };
  }

  async generateObject<T>(req: GenerateObjectRequest<T>): Promise<T> {
    const content: BetaContentBlockParam[] = [
      ...(req.images ?? []).map(toImageBlock),
      { type: "text", text: req.prompt },
    ];

    const response = await this.client.beta.messages.parse({
      model: this.models[req.task],
      max_tokens: 16_000,
      system: req.system,
      messages: [{ role: "user", content }],
      output_config: { effort: EFFORT[req.task], format: betaZodOutputFormat(req.schema) },
      // If a safety classifier declines, the API retries on a fallback model
      // within the same call instead of failing the save.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (response.stop_reason === "refusal") {
      throw new LlmRefusalError(
        response.stop_details?.explanation ?? "The model declined this request",
        response.stop_details?.category ?? null,
      );
    }
    if (response.stop_reason === "max_tokens") {
      throw new LlmOutputError(`${req.schemaName}: output hit max_tokens`);
    }
    if (response.parsed_output == null) {
      throw new LlmOutputError(`${req.schemaName}: model returned no parseable output`);
    }
    return response.parsed_output as T;
  }
}

function toImageBlock(image: LlmImage): BetaContentBlockParam {
  return image.kind === "base64"
    ? { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } }
    : { type: "image", source: { type: "url", url: image.url } };
}
