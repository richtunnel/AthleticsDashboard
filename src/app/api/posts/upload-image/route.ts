import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { ApiResponse } from "@/lib/utils/api-response";
import { logger } from "@/lib/utils/logger";
import { s3Client, SPACES_BUCKET, SPACES_CDN_URL, PutObjectCommand } from "@/lib/utils/s3";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
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

export async function POST(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";

  try {
    const session = await requireAuth();

    const hasS3Config = !!(
      SPACES_BUCKET &&
      (process.env.DO_SPACES_ACCESS_KEY || process.env.DO_SPACES_ACCESS_KEY_NAME) &&
      process.env.DO_SPACES_SECRET_KEY &&
      process.env.DO_SPACES_ENDPOINT
    );

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) return ApiResponse.error("No file provided");

    if (file.size > MAX_FILE_SIZE) {
      return ApiResponse.error(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 2MB.`
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
    const key = `posts/${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    // Attempt S3 upload (production always uses S3; dev only attempts if fully configured)
    if (hasS3Config) {
      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: SPACES_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            ACL: "public-read",
          })
        );
        const url = `${SPACES_CDN_URL}/${key}`;
        logger.info("[PostImageUpload] Uploaded to S3", { key, bytes: buffer.length });
        return ApiResponse.success({ url, key });
      } catch (s3Err: any) {
        // Log full S3 error details for debugging
        logger.error("[PostImageUpload] S3 upload failed", {
          errorName: s3Err?.name,
          errorMessage: s3Err?.message,
          errorCode: s3Err?.Code || s3Err?.code,
          httpStatus: s3Err?.$metadata?.httpStatusCode,
          requestId: s3Err?.$metadata?.requestId,
          stack: s3Err?.stack,
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

    // Local fallback (dev only)
    if (!isDev) {
      logger.error("[PostImageUpload] S3 not configured in production");
      return ApiResponse.error(
        "Image upload service is currently unavailable. Please try again later.",
        503
      );
    }

    const localDir = path.join(process.cwd(), "public", "uploads", "posts");
    if (!existsSync(localDir)) await mkdir(localDir, { recursive: true });
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    await writeFile(path.join(localDir, filename), buffer);
    const url = `/uploads/posts/${filename}`;
    logger.info("[PostImageUpload] Saved locally (dev fallback)", { url, bytes: buffer.length });
    return ApiResponse.success({ url, key: `posts/local/${filename}` });
  } catch (error: any) {
    logger.error("[PostImageUpload] Unhandled error", {
      errorName: error?.name,
      errorMessage: error?.message,
      errorCode: error?.Code || error?.code,
      httpStatus: error?.$metadata?.httpStatusCode,
      stack: error?.stack,
    });
    return ApiResponse.error(
      "Image upload service is currently unavailable. Please try again later.",
      500
    );
  }
}
