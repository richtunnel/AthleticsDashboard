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
 * to DigitalOcean Spaces — bypassing the Node server entirely for the actual
 * byte transfer.
 *
 * Requires the Spaces bucket CORS to allow PUT from the site origin
 * (https://opletics.com). The client falls back to /api/posts/upload-image
 * (same-origin proxy) on any failure.
 *
 * Security model
 * ──────────────
 * The presigned URL is a single-use, time-locked capability:
 *   • Expires in 60 seconds
 *   • Locked to ContentType + ContentLength (no swap, no padding)
 *   • Locked to a user-scoped Key (`posts/{userId}/{ts}-{rand}.ext`)
 *   • Locked to ACL=public-read (can't make private or overwrite an ACL)
 *
 * All gate-keeping happens BEFORE the URL is issued:
 *   • Auth required
 *   • Rate-limited (60/min/user)
 *   • Size + MIME validated
 *   • Tamper-proof random key
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB ceiling; client compresses to ~2 MB
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

    const ext = EXT_BY_MIME[contentType] ?? ".bin";
    const rand = crypto.randomBytes(8).toString("hex");
    const key = `posts/${session.user.id}/${Date.now()}-${rand}${ext}`;

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
