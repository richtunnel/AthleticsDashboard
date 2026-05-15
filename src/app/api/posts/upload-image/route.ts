import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { ApiResponse } from "@/lib/utils/api-response";
import { logger } from "@/lib/utils/logger";
import { s3Client, SPACES_BUCKET, SPACES_CDN_URL, PutObjectCommand } from "@/lib/utils/s3";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB (client should compress first)
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
  try {
    const session = await requireAuth();
    const isDev = process.env.NODE_ENV !== "production";
    const hasS3Config = !!(
      SPACES_BUCKET &&
      (process.env.DO_SPACES_ACCESS_KEY || process.env.DO_SPACES_ACCESS_KEY_NAME) &&
      process.env.DO_SPACES_SECRET_KEY
    );

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) return ApiResponse.error("No file provided");

    if (file.size > MAX_FILE_SIZE) {
      return ApiResponse.error(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 2MB. Please compress before uploading.`
      );
    }

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const isValidMime = ALLOWED_TYPES.includes(file.type);
    const isValidExt = ALLOWED_EXTENSIONS.includes(ext);
    if (!isValidMime && !isValidExt) {
      return ApiResponse.error(
        `Invalid file type "${file.type || ext}". Supported: JPG, PNG, WebP.`
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const contentType = file.type || EXTENSION_TO_MIME[ext] || "image/jpeg";
    const key = `posts/${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    if (hasS3Config) {
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
      logger.info("[PostImageUpload] Uploaded to S3", { key, size: buffer.length });
      return ApiResponse.success({ url, key });
    }

    // Local fallback for development
    if (!isDev) {
      return ApiResponse.error("File storage is not configured.", 500);
    }
    const localDir = path.join(process.cwd(), "public", "uploads", "posts");
    if (!existsSync(localDir)) await mkdir(localDir, { recursive: true });
    const filename = key.replace("posts/", "").replace(/\//g, "-");
    await writeFile(path.join(localDir, filename), buffer);
    const url = `/uploads/posts/${filename}`;
    logger.info("[PostImageUpload] Saved locally", { url });
    return ApiResponse.success({ url, key });
  } catch (error: any) {
    logger.error("[PostImageUpload] Error", { error: error.message });
    return ApiResponse.error(error.message || "Upload failed", 500);
  }
}
