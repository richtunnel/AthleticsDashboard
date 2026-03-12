import { NextRequest } from "next/server";
import { put, del } from "@vercel/blob";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";

// Try to import sharp, but make it optional
let sharp: any = null;
try {
  sharp = require("sharp");
} catch (error) {
  console.warn("Sharp not available, image optimization will be skipped");
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
];

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

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return ApiResponse.error("No file selected. Please choose an image file to upload.");
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return ApiResponse.error(
        `File too large (${sizeMB}MB). The maximum allowed size is 2MB. ` +
        "Please compress your image or use a smaller file."
      );
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
        "If you're uploading from an iPhone, try converting the image to JPEG first."
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
      } catch (error) {
        console.warn("Image optimization failed, using original:", error);
        // Continue with original buffer
      }
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const ext = wasOptimized ? ".png" : fileExtension || ".png";
    const filename = `signatures/${session.user.id}_${timestamp}_${randomSuffix}${ext}`;

    // Delete old signature logo from blob storage if one exists
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { signatureLogoUrl: true } as any,
      }) as any;

      if (user?.signatureLogoUrl && user.signatureLogoUrl.includes("vercel-storage.com")) {
        await del(user.signatureLogoUrl);
      }
    } catch (error) {
      console.warn("Failed to delete old signature logo:", error);
      // Continue with upload even if old file deletion fails
    }

    // Upload to Vercel Blob Storage
    const blob = await put(filename, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });

    // Auto-save the logo URL to the user's profile
    await prisma.user.update({
      where: { id: session.user.id },
      data: { signatureLogoUrl: blob.url } as any,
    });

    return ApiResponse.success({
      message: wasOptimized
        ? "Logo uploaded and optimized successfully"
        : "Logo uploaded successfully",
      url: blob.url,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
