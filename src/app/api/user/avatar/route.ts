import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { ApiResponse } from "@/lib/utils/api-response";
import { logger } from "@/lib/utils/logger";
import { s3Client, SPACES_BUCKET, SPACES_CDN_URL, PutObjectCommand, DeleteObjectCommand } from "@/lib/utils/s3";
import { prisma } from "@/lib/database/prisma";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for avatars
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
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
    const userId = session.user.id;

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
      return ApiResponse.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`);
    }

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
      return ApiResponse.error(`Invalid file type. Supported: JPG, PNG, WebP.`);
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const contentType = file.type || EXTENSION_TO_MIME[ext] || "image/jpeg";

    // Fetch current user to get old avatarKey for cleanup
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarKey: true },
    });

    let imageUrl: string;
    let newKey: string;

    if (hasS3Config) {
      newKey = `avatars/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: SPACES_BUCKET,
            Key: newKey,
            Body: buffer,
            ContentType: contentType,
            ACL: "public-read",
          })
        );
        imageUrl = `${SPACES_CDN_URL}/${newKey}`;
        logger.info("[AvatarUpload] Uploaded to S3", { key: newKey, bytes: buffer.length });

        // Delete old avatar from S3 if it exists
        if (currentUser?.avatarKey && currentUser.avatarKey.startsWith("avatars/")) {
          try {
            await s3Client.send(new DeleteObjectCommand({ Bucket: SPACES_BUCKET, Key: currentUser.avatarKey }));
          } catch {
            logger.warn("[AvatarUpload] Failed to delete old avatar", { key: currentUser.avatarKey });
          }
        }
      } catch (s3Err: any) {
        logger.error("[AvatarUpload] S3 upload failed", {
          errorName: s3Err?.name,
          errorMessage: s3Err?.message,
          httpStatus: s3Err?.$metadata?.httpStatusCode,
        });
        if (!isDev) {
          return ApiResponse.error("Image upload service is unavailable. Please try again later.", 503);
        }
        logger.warn("[AvatarUpload] S3 failed in dev — falling back to local storage");
        // Fall through to local
        const localResult = await saveLocally(buffer, ext, userId);
        imageUrl = localResult.url;
        newKey = localResult.key;
      }
    } else if (isDev) {
      const localResult = await saveLocally(buffer, ext, userId);
      imageUrl = localResult.url;
      newKey = localResult.key;
    } else {
      logger.error("[AvatarUpload] S3 not configured in production");
      return ApiResponse.error("Image upload service is unavailable. Please try again later.", 503);
    }

    // Persist new image URL and key to DB
    await prisma.user.update({
      where: { id: userId },
      data: { image: imageUrl, avatarKey: newKey! },
    });

    return ApiResponse.success({ url: imageUrl });
  } catch (error: any) {
    logger.error("[AvatarUpload] Unhandled error", { errorMessage: error?.message });
    return ApiResponse.error("Failed to upload avatar. Please try again.", 500);
  }
}

async function saveLocally(buffer: Buffer, ext: string, userId: string) {
  const localDir = path.join(process.cwd(), "public", "uploads", "avatars");
  if (!existsSync(localDir)) await mkdir(localDir, { recursive: true });
  const filename = `${userId}-${Date.now()}${ext}`;
  await writeFile(path.join(localDir, filename), buffer);
  return { url: `/uploads/avatars/${filename}`, key: `avatars/local/${filename}` };
}
