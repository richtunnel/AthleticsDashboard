import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { ApiResponse } from "@/lib/utils/api-response";
import { logger } from "@/lib/utils/logger";
import {
  s3Client,
  SPACES_BUCKET,
  SPACES_CDN_URL,
  S3_CONFIGURED,
  PutObjectCommand,
} from "@/lib/utils/s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { rateLimit } from "@/lib/middleware/rateLimit";
import crypto from "crypto";

export const runtime = "nodejs";

/**
 * POST /api/posts/upload-image/presign
 *
 * Returns a short-lived presigned PUT URL the client uses to upload directly
 * to DigitalOcean Spaces — bypassing the Node server for the byte transfer.
 *
 * Bucket CORS must allow PUT from the site origin (configured 2026-05-29).
 * The client falls back to /api/posts/upload-image (same-origin proxy) on any
 * failure so a misconfigured CORS rule never blocks a real user.
 *
 * Security envelope (everything is locked into the signature)
 * ───────────────────────────────────────────────────────────
 *   • expiresIn: 60s              — stolen URL is useless after 60 seconds
 *   • ContentType locked          — can't swap a jpg signature for an exe
 *   • ContentLength locked        — can't pad it to upload a 500 MB file
 *   • Key user-scoped + random    — can only write to posts/{userId}/{ts}-{rand}.ext
 *   • ACL=public-read locked      — can't make private or overwrite ACL
 *   • Auth required + 60/min rate limit before any URL is even issued
 *   • MIME allowlist + 5 MB max enforced server-side
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const PRESIGN_TTL_SECONDS = 60;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const rl = await rateLimit({
      key: `presign:${session.user.id}`,
      limit: 60,
      windowSec: 60,
    });
    if (rl.response) return rl.response;

    if (!S3_CONFIGURED) {
      logger.error("[Presign] S3 not configured");
      return ApiResponse.error("Image upload is not configured on this server.", 503);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return ApiResponse.error("Invalid request body");
    }

    const filename = String(body.filename ?? "").trim();
    const contentType = String(body.contentType ?? "").trim().toLowerCase();
    const size = Number(body.size);

    if (!filename) return ApiResponse.error("filename is required");
    if (!contentType) return ApiResponse.error("contentType is required");
    if (!Number.isFinite(size) || size <= 0) {
      return ApiResponse.error("size must be a positive number");
    }
    if (size > MAX_FILE_SIZE) {
      return ApiResponse.error(
        `File too large (${(size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_FILE_SIZE / 1024 / 1024} MB.`
      );
    }
    if (!ALLOWED_TYPES.has(contentType)) {
      return ApiResponse.error(
        `Invalid content type "${contentType}". Allowed: JPEG, PNG, WebP, HEIC.`
      );
    }

    // User-scoped, random-suffixed key. Can never collide, can never be guessed.
    const ext = EXT_BY_MIME[contentType] ?? ".bin";
    const rand = crypto.randomBytes(8).toString("hex");
    const key = `posts/${session.user.id}/${Date.now()}-${rand}${ext}`;

    // Sign EVERY constraint into the URL. If the client uploads anything that
    // doesn't match (different MIME, different size, different ACL, different
    // key), Spaces rejects with SignatureDoesNotMatch.
    const cmd = new PutObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
      ACL: "public-read",
      CacheControl: "public, max-age=31536000, immutable",
    });

    const uploadUrl = await getSignedUrl(s3Client, cmd, {
      expiresIn: PRESIGN_TTL_SECONDS,
      // These four are the ONLY headers the client is required to send. The
      // signature is locked to them; anything else the browser auto-adds
      // (origin, sec-fetch-*, etc.) is harmless because Spaces ignores
      // un-signed headers.
      signableHeaders: new Set(["host", "content-type", "content-length", "x-amz-acl"]),
    });

    const publicUrl = `${SPACES_CDN_URL}/${key}`;

    logger.info("[Presign] Issued", {
      userId: session.user.id,
      key,
      bytes: size,
    });

    return ApiResponse.success({
      uploadUrl,
      publicUrl,
      key,
      expiresIn: PRESIGN_TTL_SECONDS,
      // Headers the client MUST set on the PUT. These match signableHeaders
      // above exactly — any drift between this list and the signed list
      // produces SignatureDoesNotMatch on every upload.
      requiredHeaders: {
        "Content-Type": contentType,
        "x-amz-acl": "public-read",
      },
    });
  } catch (error: any) {
    logger.error("[Presign] Failed", {
      errorName: error?.name,
      errorMessage: error?.message,
    });
    return NextResponse.json(
      { success: false, error: "Failed to create upload URL. Please try again." },
      { status: 500 }
    );
  }
}
