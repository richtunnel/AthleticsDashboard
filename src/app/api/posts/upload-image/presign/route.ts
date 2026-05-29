import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/posts/upload-image/presign
 *
 * Currently disabled — returns 410 so any stale client bundle that still
 * calls this endpoint flips to the same-origin proxy upload immediately,
 * skipping all CORS / S3-PUT machinery.
 *
 * To re-enable the fast path:
 *   1. Ensure Spaces bucket CORS allows PUT from https://opletics.com.
 *   2. Restore the presign implementation from git history.
 *   3. Update PostComposer.uploadImage() to try presign first.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error:
        "Direct-to-Spaces upload is disabled. The client will use the proxy upload route automatically.",
      useProxy: true,
    },
    { status: 410 }
  );
}
