import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import {
  uploadToSpaces,
  generatePath,
  getCachedUrl,
  getSpacesConfig,
} from "@/lib/spaces";
import { checkStorageBeforeWrite } from "@/lib/utils/storage-check";

// Try to import sharp, but make it optional
let sharp: typeof import("sharp") | null = null;
try {
  sharp = require("sharp");
} catch {
  console.warn("Sharp not available, image optimization will be skipped");
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
];

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"];

const EXTENSION_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

/**
 * POST /api/upload/image
 *
 * Upload images to Digital Ocean Spaces with CDN caching
 *
 * Features:
 * - Content-based deduplication (skip upload if file unchanged)
 * - Automatic image optimization with Sharp
 * - Versioned filenames for immutable caching
 * - Organization-scoped storage paths
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Check Spaces configuration
    const spacesConfig = getSpacesConfig();
    if (!spacesConfig.isConfigured) {
      return ApiResponse.error(
        "Storage not configured. Please contact support.",
        503
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const entityType = (formData.get("entityType") as string) || "general";
    const optimize = formData.get("optimize") !== "false"; // Default true
    const maxWidth = parseInt((formData.get("maxWidth") as string) || "1920", 10);
    const quality = parseInt((formData.get("quality") as string) || "85", 10);

    if (!file) {
      return ApiResponse.error("No file provided", 400);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return ApiResponse.error(
        `File too large (${sizeMB}MB). Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
      );
    }

    // Validate file type
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const isValidMimeType = ALLOWED_TYPES.includes(file.type);
    const isValidExtension = ALLOWED_EXTENSIONS.includes(fileExtension);

    if (!isValidMimeType && !isValidExtension) {
      return ApiResponse.error(
        `Invalid file type. Allowed: JPG, PNG, GIF, WebP, HEIC`
      );
    }

    // Check storage quota before upload
    const storageCheck = await checkStorageBeforeWrite({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      estimatedSize: file.size,
    });

    if (storageCheck) {
      return storageCheck;
    }

    // Read file bytes
    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);
    let mimeType = file.type || EXTENSION_TO_MIME[fileExtension] || "image/png";
    let dimensions: { width: number; height: number } | undefined;
    let wasOptimized = false;

    // Optimize with Sharp if available
    if (sharp && optimize) {
      try {
        const sharpInstance = sharp(buffer);
        const metadata = await sharpInstance.metadata();

        // Resize if larger than maxWidth
        if (metadata.width && metadata.width > maxWidth) {
          sharpInstance.resize({
            width: maxWidth,
            withoutEnlargement: true,
            fit: "inside",
          });
        }

        // Convert to WebP for better compression (unless it's an animated GIF)
        if (metadata.format !== "gif" && fileExtension !== ".gif") {
          buffer = await sharpInstance.webp({ quality, effort: 6 }).toBuffer();
          mimeType = "image/webp";
          wasOptimized = true;
        } else {
          // For GIFs, just optimize without format conversion
          buffer = await sharpInstance.gif().toBuffer();
        }

        // Get final dimensions
        const finalMetadata = await sharp(buffer).metadata();
        if (finalMetadata.width && finalMetadata.height) {
          dimensions = {
            width: finalMetadata.width,
            height: finalMetadata.height,
          };
        }
      } catch (error) {
        console.warn("Image optimization failed, using original:", error);
        // Continue with original buffer
      }
    }

    // Generate filename with organization scoping
    const filename = generatePath(
      session.user.organizationId,
      entityType,
      session.user.id,
      file.name,
      { versioned: true, buffer }
    );

    // Check if identical file already exists (content-based deduplication)
    const cachedUrl = await getCachedUrl(filename);
    if (cachedUrl) {
      return ApiResponse.success({
        message: "Image already exists (deduplicated)",
        url: cachedUrl,
        source: "cache",
        optimized: wasOptimized,
        dimensions,
      });
    }

    // Upload to Spaces with caching headers
    const result = await uploadToSpaces(filename, buffer, {
      contentType: mimeType,
      isPublic: true,
      skipIfUnchanged: true,
      dimensions,
      metadata: {
        "uploaded-by": session.user.id,
        "organization-id": session.user.organizationId,
        "entity-type": entityType,
        "original-filename": file.name,
        optimized: wasOptimized ? "true" : "false",
      },
    });

    return ApiResponse.success({
      message: wasOptimized
        ? "Image uploaded and optimized successfully"
        : "Image uploaded successfully",
      url: result.cdnUrl,
      source: result.isCached ? "cache" : "upload",
      optimized: wasOptimized,
      dimensions,
      size: {
        bytes: result.size,
        formatted: formatBytes(result.size),
      },
      etag: result.etag,
      contentHash: result.contentHash,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}
