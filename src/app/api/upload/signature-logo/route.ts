import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import sharp from "sharp";
import { createHash } from "crypto";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return ApiResponse.error("No file provided");
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return ApiResponse.error("File size exceeds 2MB limit");
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return ApiResponse.error("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed");
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
    await writeFile(originalFilepath, buffer);

    // Optimize image with Sharp and create WebP version
    const webpFilename = `signature-${session.user.id}-${timestamp}.webp`;
    const webpFilepath = path.join(uploadDir, webpFilename);
    
    // Convert to WebP with optimization
    await sharp(buffer)
      .webp({ quality: 80 })
      .toFile(webpFilepath);

    // Generate versioned URL with content hash for cache busting
    const fileHash = createHash("md5").update(buffer).digest("hex").substring(0, 8);
    const versionedUrl = `/uploads/signatures/${webpFilename}?v=${fileHash}`;

    // Return optimized WebP URL with versioning
    const publicUrl = versionedUrl;

    return ApiResponse.success({
      message: "Logo uploaded successfully",
      url: publicUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
