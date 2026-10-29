import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { processVideo } from "../src/server/ingest/video";
import { FixtureProvider, FixtureTranscriber } from "../src/server/providers/fixture";
import { fakeFetch, fakeLookup, llmFixture } from "./helpers";

describe("processVideo", () => {
  it("extracts audio for Whisper and keyframes for caption OCR", async () => {
    const commands: string[][] = [];
    // Pretend to be ffmpeg: write whatever output file the args ask for.
    const run = async (command: string, args: string[]) => {
      commands.push([command, ...args]);
      const out = args[args.length - 1]!;
      if (out.endsWith(".mp3")) await writeFile(out, new Uint8Array([1, 2, 3]));
      if (out.includes("frame-%02d")) {
        for (const n of ["01", "02", "03"]) await writeFile(out.replace("%02d", n), new Uint8Array([255, 216, 255]));
      }
    };
    const { fetch } = fakeFetch({ "https://blob.example/": { body: "fake-mp4-bytes", contentType: "video/mp4" } });
    const llm = new FixtureProvider({ vision_ocr: [llmFixture("ocr-frames")] });

    const result = await processVideo("https://blob.example/reel.mp4", {
      ffmpegPath: "/usr/bin/ffmpeg",
      transcriber: new FixtureTranscriber("Today we're doing Bulgarian split squats, four sets of eight."),
      llm,
      fetch,
      lookup: fakeLookup(),
      run,
      maxFrames: 6,
    });

    expect(result.transcript).toBe("Today we're doing Bulgarian split squats, four sets of eight.");
    expect(result.ocrText).toContain("Bulgarian split squat 4x8 each leg");
    const audio = commands.find((c) => c.at(-1)!.endsWith(".mp3"))!;
    expect(audio).toEqual(expect.arrayContaining(["-vn", "-ac", "1", "-ar", "16000"]));
    const frames = commands.find((c) => c.includes("-vf"))!;
    expect(frames[frames.indexOf("-vf") + 1]).toBe("fps=1/3,scale=720:-2");
    expect(frames[frames.indexOf("-frames:v") + 1]).toBe("6");
    expect(llm.calls[0]!.imageCount).toBe(3);
    expect(path.basename(audio[0]!)).toBe("ffmpeg");
  });

  it("still returns OCR when there's no transcriber or audio fails", async () => {
    const run = async (_cmd: string, args: string[]) => {
      const out = args[args.length - 1]!;
      if (out.endsWith(".mp3")) throw new Error("Output file #0 does not contain any stream");
      if (out.includes("frame-%02d")) await writeFile(out.replace("%02d", "01"), new Uint8Array([1]));
    };
    const { fetch } = fakeFetch({ "https://blob.example/": { body: "x", contentType: "video/mp4" } });
    const llm = new FixtureProvider({ vision_ocr: [llmFixture("ocr-frames")] });
    const result = await processVideo("https://blob.example/silent.mp4", {
      ffmpegPath: "ffmpeg",
      transcriber: new FixtureTranscriber("unused"),
      llm,
      fetch,
      lookup: fakeLookup(),
      run,
    });
    expect(result.transcript).toBeNull();
    expect(result.ocrText).toContain("LEG DAY");
  });
});
