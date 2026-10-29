import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { LlmProvider, Transcriber } from "../providers/types";
import { ocrImages } from "./ocr";
import { safeFetch, type LookupFn } from "./safe-fetch";

const execFileAsync = promisify(execFile);

export type CommandRunner = (command: string, args: string[]) => Promise<void>;

const defaultRunner: CommandRunner = async (command, args) => {
  await execFileAsync(command, args, { timeout: 240_000, maxBuffer: 10 * 1024 * 1024 });
};

export interface VideoDeps {
  ffmpegPath: string;
  transcriber: Transcriber | null;
  llm: LlmProvider;
  fetch?: typeof fetch;
  lookup?: LookupFn;
  run?: CommandRunner;
  /** Keyframes to OCR for on-screen captions. */
  maxFrames?: number;
}

export interface VideoResult {
  transcript: string | null;
  ocrText: string | null;
}

/** Videos above this size are rejected before download (Blob uploads are capped too). */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

/**
 * Runs in the background job, never in a request: downloads the video,
 * extracts mono 16 kHz audio for Whisper and a handful of keyframes for
 * caption OCR. Both halves are best effort; a silent video still gets OCR.
 */
export async function processVideo(videoUrl: string, deps: VideoDeps): Promise<VideoResult> {
  const run = deps.run ?? defaultRunner;
  const dir = await mkdtemp(path.join(tmpdir(), "echo-video-"));
  try {
    const download = await safeFetch(videoUrl, { fetch: deps.fetch, lookup: deps.lookup, maxBytes: MAX_VIDEO_BYTES, timeoutMs: 60_000, accept: "video/*" });
    if (download.status !== 200) throw new Error(`Video download failed with ${download.status}`);
    const input = path.join(dir, "input");
    await writeFile(input, download.body);

    const [transcript, ocrText] = await Promise.all([
      transcribeAudio(input, dir, run, deps),
      ocrKeyframes(input, dir, run, deps),
    ]);
    return { transcript, ocrText };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function transcribeAudio(input: string, dir: string, run: CommandRunner, deps: VideoDeps) {
  if (!deps.transcriber) return null;
  const audio = path.join(dir, "audio.mp3");
  try {
    await run(deps.ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", audio]);
    const bytes = await readFile(audio);
    if (bytes.byteLength === 0) return null;
    const text = await deps.transcriber.transcribe(bytes, "audio.mp3");
    return text.trim() || null;
  } catch (err) {
    // No audio stream is common for caption-only reels.
    console.warn("Audio transcription skipped:", (err as Error).message);
    return null;
  }
}

async function ocrKeyframes(input: string, dir: string, run: CommandRunner, deps: VideoDeps) {
  const maxFrames = deps.maxFrames ?? 6;
  const framesDir = path.join(dir, "frames");
  await mkdir(framesDir, { recursive: true });
  try {
    // One frame every 3 seconds, scaled down; captions survive 720px fine.
    await run(deps.ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-y", "-i", input,
      "-vf", "fps=1/3,scale=720:-2", "-frames:v", String(maxFrames), "-q:v", "4",
      path.join(framesDir, "frame-%02d.jpg"),
    ]);
    const files = (await readdir(framesDir)).filter((f) => f.endsWith(".jpg")).sort().slice(0, maxFrames);
    if (files.length === 0) return null;
    const images = await Promise.all(
      files.map(async (f) => ({
        kind: "base64" as const,
        mediaType: "image/jpeg" as const,
        data: (await readFile(path.join(framesDir, f))).toString("base64"),
      })),
    );
    const result = await ocrImages(images, deps.llm, "video_frames");
    return result.text.trim() || null;
  } catch (err) {
    console.warn("Keyframe OCR skipped:", (err as Error).message);
    return null;
  }
}

/** Writes bytes to a temp file; exported for the job runner's Blob downloads. */
export async function writeTemp(bytes: Uint8Array, name: string) {
  const dir = await mkdtemp(path.join(tmpdir(), "echo-"));
  const file = path.join(dir, name);
  await writeFile(file, bytes);
  return { file, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
