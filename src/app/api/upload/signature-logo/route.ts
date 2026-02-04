import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { createHash } from "crypto";

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

    // Create unique filename
    const timestamp = Date.now();
    const extension = path.extname(file.name);
    const filename = `signature-${session.user.id}-${timestamp}${extension}`;

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), "public", "uploads", "signatures");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Save original file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const originalFilepath = path.join(uploadDir, filename);
    
    try {
      await writeFile(originalFilepath, buffer);
    } catch (error) {
      console.error("Failed to save original file:", error);
      return ApiResponse.error("Failed to save uploaded file. Please try again.");
    }

    // Optimize image with Sharp and create WebP version (if Sharp is available)
    let optimizedUrl = "";
    let message = "Logo uploaded successfully";
    
    // Get base URL for absolute links in emails
    const baseUrl = process.env.NEXTAUTH_URL || "https://opletics.com";
    const absoluteBaseUrl = baseUrl.replace(/\/$/, "");
    
    if (sharp) {
      const webpFilename = `signature-${session.user.id}-${timestamp}.webp`;
      const webpFilepath = path.join(uploadDir, webpFilename);
      
      try {
        // Convert to WebP with optimization
        await sharp(buffer)
          .webp({ quality: 80 })
          .toFile(webpFilepath);
        
        // Generate versioned URL with content hash for cache busting
        const fileHash = createHash("md5").update(buffer).digest("hex").substring(0, 8);
        optimizedUrl = `${absoluteBaseUrl}/uploads/signatures/${webpFilename}?v=${fileHash}`;
        message = "Logo uploaded and optimized successfully";
      } catch (error) {
        console.error("Failed to optimize image:", error);
        // Fallback to original file
        const fallbackUrl = `${absoluteBaseUrl}/uploads/signatures/${filename}`;
        optimizedUrl = fallbackUrl;
        message = "Logo uploaded successfully (without optimization)";
      }
    } else {
      // Sharp not available, use original file
      const fallbackUrl = `${absoluteBaseUrl}/uploads/signatures/${filename}`;
      optimizedUrl = fallbackUrl;
      message = "Logo uploaded successfully (optimization not available)";
    }


    return ApiResponse.success({
      message: message,
      url: optimizedUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
