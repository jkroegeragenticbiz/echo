import { describe, expect, it } from "vitest";
import { canonicalizeUrl, detectPlatform, extractXPostId, normalizeForHash } from "../src/url";

describe("canonicalizeUrl", () => {
  it.each([
    ["https://twitter.com/Jack/status/20?s=20&t=abc", "https://x.com/jack/status/20"],
    ["https://mobile.x.com/jack/status/20/photo/1", "https://x.com/jack/status/20"],
    ["https://www.instagram.com/reel/C7abc123XYZ/?igshid=MzRlODBiNWFlZA==&utm_source=ig_web", "https://instagram.com/reel/C7abc123XYZ"],
    ["https://instagram.com/someuser/p/ABC/?igsh=xyz", "https://instagram.com/p/ABC"],
    ["https://youtu.be/dQw4w9WgXcQ?si=share123", "https://youtube.com/watch?v=dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=abc&feature=share&t=42", "https://youtube.com/watch?t=42&v=abc"],
    ["https://www.tiktok.com/@rae/video/123?is_from_webapp=1&sender_device=pc&_r=1", "https://tiktok.com/@rae/video/123"],
    [
      "https://www.linkedin.com/posts/maya_cold-email-activity-1/?utm_source=share&utm_medium=member_ios&trk=x",
      "https://linkedin.com/posts/maya_cold-email-activity-1",
    ],
    ["https://Example.com/a/b/#section", "https://example.com/a/b"],
    ["http://example.com/?b=2&a=1&fbclid=zzz", "https://example.com?a=1&b=2"],
  ])("%s", (input, expected) => {
    expect(canonicalizeUrl(input)).toBe(expected);
  });

  it("rejects non-http urls", () => {
    expect(canonicalizeUrl("mailto:a@b.com")).toBeNull();
    expect(canonicalizeUrl("not a url")).toBeNull();
  });

  it("keeps meaningful params on hosts where they are not tracking", () => {
    expect(canonicalizeUrl("https://example.com/search?s=shoes")).toBe("https://example.com/search?s=shoes");
  });
});

describe("detectPlatform", () => {
  it.each([
    ["https://twitter.com/a/status/1", "x"],
    ["https://lnkd.in/abc", "linkedin"],
    ["https://www.instagram.com/reel/x", "instagram"],
    ["https://vm.tiktok.com/ZM123/", "tiktok"],
    ["https://youtu.be/abc", "youtube"],
    ["https://blog.example.com/post", "web"],
    [undefined, "manual"],
  ] as const)("%s -> %s", (input, expected) => {
    expect(detectPlatform(input)).toBe(expected);
  });
});

describe("extractXPostId", () => {
  it("reads the id from any X url form", () => {
    expect(extractXPostId("https://twitter.com/a/status/1790000000000000002?s=46")).toBe("1790000000000000002");
    expect(extractXPostId("https://example.com/a/status/1")).toBeNull();
  });
});

describe("normalizeForHash", () => {
  it("ignores case, whitespace, links and punctuation", () => {
    expect(normalizeForHash("Hello,   WORLD!! https://t.co/x\n")).toBe(normalizeForHash("hello world"));
    expect(normalizeForHash("Up 31%")).not.toBe(normalizeForHash("Up 13%"));
  });
});
