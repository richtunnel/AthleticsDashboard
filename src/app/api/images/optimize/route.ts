import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import * as path from "path";
import { promisify } from "util";
import { pipeline } from "stream";
import { createHash } from "crypto";
import { generateETag, checkETagMatch } from "@/lib/utils/etag";

const pump = promisify(pipeline);

const CACHE_DIR = path.join(process.cwd(), "public", "cache", "images");
const MAX_AGE = 365 * 24 * 60 * 60; // 1 year

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");
    const width = parseInt(searchParams.get("w") || "0");
    const height = parseInt(searchParams.get("h") || "0");
    const quality = parseInt(searchParams.get("q") || "80");
    const format = searchParams.get("format") || "webp";

    if (!imageUrl) {
      return new NextResponse("Missing image URL parameter", { status: 400 });
    }

    // Generate cache key based on parameters
    const cacheKey = createHash("md5")
      .update(`${imageUrl}-w${width}-h${height}-q${quality}-${format}`)
      .digest("hex");
    
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.${format}`);

    // Check if cached version exists
    if (existsSync(cachePath)) {
      const cachedImage = readFileSync(cachePath);
      const etag = generateETag(cachedImage);
      
      // Check If-None-Match header for ETag validation
      const ifNoneMatch = request.headers.get("if-none-match");
      if (checkETagMatch(etag, ifNoneMatch)) {
        return new NextResponse(null, { status: 304 }); // Not Modified
      }

      return new NextResponse(cachedImage, {
        status: 200,
        headers: {
          "Content-Type": `image/${format}`,
          "Cache-Control": `public, max-age=${MAX_AGE}, immutable`,
          "ETag": etag,
          "Content-Length": cachedImage.length.toString(),
        },
      });
    }

    // Fetch original image
    let imageBuffer: Buffer;
    if (imageUrl.startsWith("http")) {
      // External URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return new NextResponse("Failed to fetch image", { status: 404 });
      }
      imageBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      // Local file
      const localPath = path.join(process.cwd(), "public", imageUrl);
      if (!existsSync(localPath)) {
        return new NextResponse("Image not found", { status: 404 });
      }
      imageBuffer = readFileSync(localPath);
    }

    // Optimize image with Sharp
    const sharpInstance = sharp(imageBuffer);

    // Apply transformations
    if (width > 0 || height > 0) {
      sharpInstance.resize(width, height, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Convert to target format
    let optimizedBuffer: Buffer;
    switch (format.toLowerCase()) {
      case "webp":
        optimizedBuffer = await sharpInstance.webp({ quality }).toBuffer();
        break;
      case "avif":
        optimizedBuffer = await sharpInstance.avif({ quality }).toBuffer();
        break;
      case "jpeg":
      case "jpg":
        optimizedBuffer = await sharpInstance.jpeg({ quality }).toBuffer();
        break;
      case "png":
        optimizedBuffer = await sharpInstance.png().toBuffer();
        break;
      default:
        optimizedBuffer = await sharpInstance.toBuffer();
    }

    // Cache the optimized image
    writeFileSync(cachePath, optimizedBuffer);

    // Generate ETag
    const etag = generateETag(optimizedBuffer);

    return new NextResponse(optimizedBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": `image/${format}`,
        "Cache-Control": `public, max-age=${MAX_AGE}, immutable`,
        "ETag": etag,
        "Content-Length": optimizedBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Image optimization error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}