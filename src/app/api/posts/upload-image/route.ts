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
import { rateLimit } from "@/lib/middleware/rateLimit";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

// Ensure this route always runs in Node.js (uses fs, S3 SDK, and Prisma)
export const runtime = "nodejs";

// 5 MB upload ceiling — matches the presign route. The PostComposer client
// compresses every image down to ~2 MB before uploading, so almost every real
// upload lands well below this. The ceiling exists so a fallback upload (when
// presign fails and we route through this proxy) doesn't reject a slightly
// stubborn image that only got to ~2.3 MB after compression.
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
const EXTENSION_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

async function handleUpload(request: NextRequest): Promise<NextResponse> {
  const isDev = process.env.NODE_ENV !== "production";

  const session = await requireAuth();

  // ── Rate limit: 20 uploads / minute / user ──────────────────────────────
  // Prevents abuse (mass uploads, bots) and shields S3 / the Node process
  // from sudden spikes. Fails open when Redis is disabled.
  const rl = await rateLimit({
    key: `post-img:${session.user.id}`,
    limit: 20,
    windowSec: 60,
  });
  if (rl.response) return rl.response;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return ApiResponse.error("No file provided");

  if (file.size > MAX_FILE_SIZE) {
    return ApiResponse.error(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_FILE_SIZE / 1024 / 1024} MB.`
    );
  }

  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
    return ApiResponse.error(
      `Invalid file type "${file.type || ext}". Supported: JPG, PNG, WebP.`
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const contentType = file.type || EXTENSION_TO_MIME[ext] || "image/jpeg";

  // Random key avoids collisions and prevents URL guessing
  const rand = crypto.randomBytes(6).toString("hex");
  const key = `posts/${session.user.id}/${Date.now()}-${rand}${ext}`;

  // ── Production: must use S3. Dev: use S3 if configured, else local fs.
  if (S3_CONFIGURED) {
    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: SPACES_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          ACL: "public-read",
          // 1-year browser cache — keys are content-unique so they never collide
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
      const url = `${SPACES_CDN_URL}/${key}`;
      logger.info("[PostImageUpload] Uploaded to S3", { key, bytes: buffer.length });
      return ApiResponse.success({ url, key });
    } catch (s3Err: any) {
      logger.error("[PostImageUpload] S3 upload failed", {
        errorName: s3Err?.name,
        errorMessage: s3Err?.message,
        errorCode: s3Err?.Code || s3Err?.code,
        httpStatus: s3Err?.$metadata?.httpStatusCode,
        requestId: s3Err?.$metadata?.requestId,
      });

      if (!isDev) {
        return ApiResponse.error(
          "Image upload service is currently unavailable. Please try again later.",
          503
        );
      }
      // Dev: fall through to local storage
      logger.warn("[PostImageUpload] S3 failed in dev — falling back to local storage");
    }
  }

  // ── Production with no S3 config = hard failure (loud) ──────────────────
  if (!isDev) {
    logger.error(
      "[PostImageUpload] S3 not configured in production — refusing to use local fs"
    );
    return ApiResponse.error(
      "Image upload is not configured on this server. Please contact support.",
      503
    );
  }

  // ── Local fallback (dev only) ───────────────────────────────────────────
  const localDir = path.join(process.cwd(), "public", "uploads", "posts");
  if (!existsSync(localDir)) await mkdir(localDir, { recursive: true });
  const filename = `${Date.now()}-${rand}${ext}`;
  await writeFile(path.join(localDir, filename), buffer);
  const url = `/uploads/posts/${filename}`;
  logger.info("[PostImageUpload] Saved locally (dev fallback)", {
    url,
    bytes: buffer.length,
  });
  return ApiResponse.success({ url, key: `posts/local/${filename}` });
}

// Top-level wrapper guarantees a JSON response even if Next.js internals throw
export async function POST(request: NextRequest) {
  try {
    return await handleUpload(request);
  } catch (err: any) {
    logger.error("[PostImageUpload] Top-level uncaught error", {
      errorMessage: err?.message,
      errorName: err?.name,
    });
    return NextResponse.json(
      { success: false, error: "Image upload failed. Please try again." },
      { status: 500 }
    );
  }
}
