import { NextRequest } from "next/server";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { logger } from "@/lib/utils/logger";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Try to import sharp, but make it optional
let sharp: any = null;
try {
  sharp = require("sharp");
} catch (error) {
  logger.warn("Sharp not available, image optimization will be skipped");
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];

// Allowed file extensions for browsers that don't report MIME type correctly (e.g., iOS Safari)
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"];

// MIME type mapping for file extensions
const EXTENSION_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

// Digital Ocean Spaces (S3-compatible) configuration
const SPACES_BUCKET = process.env.DO_SPACES_BUCKET || "";
const SPACES_REGION = process.env.DO_SPACES_REGION || "nyc3";

// Build the base endpoint without the bucket name to avoid SSL certificate mismatches
// when forcePathStyle is false (virtual-hosted style requires clean endpoints).
// Input:  https://opletics-main-bucket.atl1.digitaloceanspaces.com
// Output: https://atl1.digitaloceanspaces.com
function buildEndpoint(rawUrl: string): string {
  // Remove trailing slash
  let url = rawUrl.replace(/\/$/, "");

  // Add https:// protocol if missing (e.g. DO_SPACES_ENDPOINT set without scheme)
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  // Parse the URL to safely remove bucket name from hostname
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // If hostname starts with "bucket." remove the bucket prefix
    if (hostname.startsWith(`${SPACES_BUCKET}.`)) {
      parsed.hostname = hostname.slice(SPACES_BUCKET.length + 1); // +1 for the dot
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    // Fallback to regex if URL parsing fails
    return url.replace(`://${SPACES_BUCKET}.`, "://");
  }
}

const rawEndpoint = process.env.DO_SPACES_ENDPOINT || `https://${SPACES_REGION}.digitaloceanspaces.com`;
const SPACES_ENDPOINT = buildEndpoint(rawEndpoint);

const rawCdnUrl = process.env.DO_SPACES_CDN_URL || `https://${SPACES_BUCKET}.${SPACES_REGION}.cdn.digitaloceanspaces.com`;
const SPACES_CDN_URL = rawCdnUrl.replace(/\/$/, "");

const FORCE_PATH_STYLE = process.env.DO_SPACES_FORCE_PATH_STYLE === "true";

const s3Client = new S3Client({
  endpoint: SPACES_ENDPOINT,
  region: SPACES_REGION,
  credentials: {
    accessKeyId: process.env.DO_SPACES_ACCESS_KEY || process.env.DO_SPACES_ACCESS_KEY_NAME || "",
    secretAccessKey: process.env.DO_SPACES_SECRET_KEY || process.env.DO_SPACES_SECRET_KEY_VALUE || "",
  },
  forcePathStyle: FORCE_PATH_STYLE,
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const isDev = process.env.NODE_ENV !== "production";
    const hasS3Config = !!(SPACES_BUCKET && (process.env.DO_SPACES_ACCESS_KEY || process.env.DO_SPACES_ACCESS_KEY_NAME));

    // Validate required S3 configuration before processing the file, but only if not in dev or if we want to use S3 in dev
    const configErrors: string[] = [];
    if (!SPACES_BUCKET) configErrors.push("DO_SPACES_BUCKET");
    if (!process.env.DO_SPACES_ACCESS_KEY && !process.env.DO_SPACES_ACCESS_KEY_NAME) configErrors.push("DO_SPACES_ACCESS_KEY");
    if (!process.env.DO_SPACES_SECRET_KEY && !process.env.DO_SPACES_SECRET_KEY_VALUE) configErrors.push("DO_SPACES_SECRET_KEY");
    if (!process.env.DO_SPACES_ENDPOINT) configErrors.push("DO_SPACES_ENDPOINT");

    if (configErrors.length > 0) {
      if (isDev) {
        // In development, log the missing config but continue - we'll use local fallback
        logger.warn(`[SignatureLogoUpload] S3 not fully configured in dev mode: ${configErrors.join(", ")}. Using local storage fallback.`);
      } else {
        logger.error(`[SignatureLogoUpload] Misconfigured S3 in production: ${configErrors.join(", ")}`);
        return ApiResponse.error(
          `File storage is misconfigured (missing: ${configErrors.join(", ")}). Please contact support.`,
          500
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return ApiResponse.error("No file selected. Please choose an image file to upload.");
    }

    logger.info(`[SignatureLogoUpload] Received upload request`, {
      userId: session.user.id,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      hasS3Config,
      isDev
    });

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return ApiResponse.error(`File too large (${sizeMB}MB). The maximum allowed size is 2MB. ` + "Please compress your image or use a smaller file.");
    }

    // Validate file type by MIME type and extension (for cross-browser compatibility)
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const isValidMimeType = ALLOWED_TYPES.includes(file.type);
    const isValidExtension = ALLOWED_EXTENSIONS.includes(fileExtension);

    // Some browsers (especially Safari on iOS) may not report HEIC MIME type correctly,
    // so we also check the file extension as a fallback
    if (!isValidMimeType && !isValidExtension) {
      const detectedType = file.type || fileExtension || "unknown";
      return ApiResponse.error(
        `Invalid file type "${detectedType}". ` +
          "Only JPG, JPEG, PNG, GIF, WebP, and iPhone/Android (HEIC) images are accepted. " +
          "If you're uploading from an iPhone, try converting the image to JPEG first.",
      );
    }

    // Read file bytes
    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);
    let contentType = file.type || EXTENSION_TO_MIME[fileExtension] || "image/png";

    // Optimize image with Sharp if available
    let wasOptimized = false;

    if (sharp) {
      try {
        logger.info("[SignatureLogoUpload] Optimizing image with sharp", {
          inputSize: buffer.length,
          inputType: contentType,
        });
        // Resize and optimize the image for email signatures
        // Max dimensions: 240x240 (double for retina, displayed at 120x120)
        const optimizedBuffer = await sharp(buffer)
          .resize(240, 240, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .png({
            palette: true,
            quality: 80,
            compressionLevel: 9,
          })
          .toBuffer();

        // Use optimized buffer (converted to PNG)
        buffer = optimizedBuffer;
        contentType = "image/png";
        wasOptimized = true;
        logger.info("[SignatureLogoUpload] Image optimized successfully", { 
          newSize: buffer.length,
          reduction: `${(((bytes.byteLength - buffer.length) / bytes.byteLength) * 100).toFixed(2)}%`
        });
      } catch (sharpError) {
        const msg = sharpError instanceof Error ? sharpError.message : String(sharpError);
        logger.error("[SignatureLogoUpload] Sharp processing failed, using original", {
          error: msg,
          stack: sharpError instanceof Error ? sharpError.stack : undefined,
        });
        // Continue with original buffer
      }
    } else {
      logger.info("[SignatureLogoUpload] Sharp not available, skipping optimization");
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const ext = wasOptimized ? ".png" : fileExtension || ".png";
    const filename = `${session.user.id}_${timestamp}_${randomSuffix}${ext}`;
    const key = `signatures/${filename}`;

    // Delete old signature logo if one exists (S3 or local)
    try {
      const user = (await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { signatureLogoUrl: true } as any,
      })) as any;

      if (user?.signatureLogoUrl) {
        if (user.signatureLogoUrl.includes("digitaloceanspaces.com") || user.signatureLogoUrl.includes("vercel-storage.com")) {
          logger.info("[SignatureLogoUpload] Deleting old logo from S3", { url: user.signatureLogoUrl });
          // Extract the key from the URL
          const url = new URL(user.signatureLogoUrl);
          const oldKey = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
          if (oldKey) {
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: SPACES_BUCKET,
                Key: oldKey,
              }),
            );
          }
        } else if (user.signatureLogoUrl.startsWith("/uploads/")) {
          logger.info("[SignatureLogoUpload] Deleting old logo from local storage", { url: user.signatureLogoUrl });
          const oldPath = path.join(process.cwd(), "public", user.signatureLogoUrl);
          if (existsSync(oldPath)) {
            await unlink(oldPath);
          }
        }
      }
    } catch (error) {
      logger.warn("[SignatureLogoUpload] Failed to delete old signature logo", { error });
      // Continue with upload even if old file deletion fails
    }

    let publicUrl = "";

    // Determine if we should use S3 based on configuration
    const shouldUseS3 = hasS3Config && SPACES_BUCKET && SPACES_ENDPOINT;

    if (!shouldUseS3) {
      // Use local storage fallback (development or misconfigured S3)
      logger.info("[SignatureLogoUpload] Using local storage fallback", { isDev });
      
      try {
        const uploadDir = path.join(process.cwd(), "public", "uploads", "signatures");
        if (!existsSync(uploadDir)) {
          await mkdir(uploadDir, { recursive: true });
          logger.info("[SignatureLogoUpload] Created local upload directory", { uploadDir });
        }

        const filePath = path.join(uploadDir, filename);
        await writeFile(filePath, buffer);
        
        publicUrl = `/uploads/signatures/${filename}`;
        
        logger.info("[SignatureLogoUpload] Local storage upload successful", { publicUrl, fileSize: buffer.length });
      } catch (localError: any) {
        const msg = localError instanceof Error ? localError.message : String(localError);
        logger.error("[SignatureLogoUpload] Local storage write failed", {
          error: msg,
          stack: localError instanceof Error ? localError.stack : undefined,
        });
        throw new Error(`Failed to save logo locally: ${msg}`);
      }
    } else {
      // Upload to Digital Ocean Spaces
      try {
        logger.info("[SignatureLogoUpload] Uploading to Digital Ocean Spaces", {
          key,
          contentType,
          bucket: SPACES_BUCKET,
          endpoint: SPACES_ENDPOINT,
        });

        await s3Client.send(
          new PutObjectCommand({
            Bucket: SPACES_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            ACL: "public-read",
          }),
        );

        publicUrl = `${SPACES_CDN_URL}/${key}`;
        logger.info("[SignatureLogoUpload] S3 upload successful", { publicUrl });
      } catch (s3Error: any) {
        const msg = s3Error instanceof Error ? s3Error.message : String(s3Error);
        const errorName = s3Error instanceof Error ? s3Error.name : "UnknownError";
        
        logger.error("[SignatureLogoUpload] S3 upload failed", {
          error: msg,
          errorName,
          bucket: SPACES_BUCKET,
          key,
        });
        
        // The SDK throws "Invalid URL" when the endpoint or bucket name produces a
        // malformed URL (e.g. empty SPACES_BUCKET → "https://.region.example.com").
        if (msg.includes("Invalid URL") || msg.includes("TypeError") || errorName === "TypeError") {
          throw new Error("File storage endpoint is misconfigured. Please verify DO_SPACES_ENDPOINT and DO_SPACES_BUCKET environment variables.");
        }
        
        if (msg.includes("SignatureDoesNotMatch") || msg.includes("InvalidAccessKeyId")) {
          throw new Error("File storage credentials (Access Key or Secret Key) are invalid.");
        }
        
        if (msg.includes("NoSuchBucket")) {
          throw new Error(`File storage bucket "${SPACES_BUCKET}" was not found.`);
        }
        
        // For other S3 errors, provide a helpful message
        throw new Error(`Failed to upload logo to file storage: ${msg}`);
      }
    }

    // Auto-save the logo URL to the user's profile
    logger.info("[SignatureLogoUpload] Updating user record with new logo URL");
    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { signatureLogoUrl: publicUrl } as any,
      });
    } catch (dbError: any) {
      const msg = dbError instanceof Error ? dbError.message : String(dbError);
      logger.error("[SignatureLogoUpload] Failed to save logo URL to user record", {
        error: msg,
        userId: session.user.id,
      });
      // The file was uploaded but we couldn't save the URL - return a partial success
      return ApiResponse.success({
        message: wasOptimized ? "Logo uploaded and optimized, but profile update failed" : "Logo uploaded, but profile update failed",
        url: publicUrl,
        warning: "Please refresh the page to see the updated logo.",
      });
    }

    return ApiResponse.success({
      message: wasOptimized ? "Logo uploaded and optimized successfully" : "Logo uploaded successfully",
      url: publicUrl,
    });
  } catch (error) {
    return await handleApiError(error);
  }
}
