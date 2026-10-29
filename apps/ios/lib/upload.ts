import { upload } from "@vercel/blob/client";
import { API_URL } from "./config";

/**
 * Uploads a local file (photo library or App Group) straight to Vercel Blob.
 * The API only mints the upload token, so videos never hit a function body limit.
 */
export async function uploadFile(uri: string, opts: { contentType: string; token: string; folder: "images" | "videos" }) {
  const blob = await (await fetch(uri)).blob();
  const ext = opts.contentType.split("/")[1]?.replace("quicktime", "mov") ?? "bin";
  const result = await upload(`${opts.folder}/${Date.now()}.${ext}`, blob, {
    access: "public",
    contentType: opts.contentType,
    handleUploadUrl: `${API_URL}/api/uploads`,
    headers: { authorization: `Bearer ${opts.token}` },
  });
  return result.url;
}
