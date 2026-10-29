import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { errorResponse } from "@/lib/http";

const ALLOWED = ["image/jpeg", "image/png", "image/heic", "image/webp", "video/mp4", "video/quicktime"];

/**
 * Client uploads straight to Vercel Blob (the web app and the iOS app), so
 * large videos never pass through a function body. We only mint the token.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as HandleUploadBody;
    const result = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const userId = await requireUserId(req);
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: 200 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId, pathname }),
        };
      },
      onUploadCompleted: async () => {
        // The client posts the blob URL to /api/saves itself.
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
