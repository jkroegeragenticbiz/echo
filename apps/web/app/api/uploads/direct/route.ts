import { put } from "@vercel/blob";
import { HttpError, json, route } from "@/lib/http";
import { requireUserId } from "@/lib/session";

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };

/**
 * Small-image upload for the Swift Share Extension (it downscales screenshots
 * to well under Vercel's 4.5 MB request limit). Videos go through the app.
 */
export const POST = route(async (req: Request) => {
  const userId = await requireUserId(req);
  const type = req.headers.get("content-type")?.split(";")[0] ?? "";
  const ext = TYPES[type];
  if (!ext) throw new HttpError(415, "Only images can be uploaded here", "unsupported_type");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) throw new HttpError(413, "Image too large", "too_large");
  const blob = await put(`shares/${userId}/${crypto.randomUUID()}.${ext}`, Buffer.from(bytes), {
    access: "public",
    contentType: type,
  });
  return json({ url: blob.url }, 201);
});
