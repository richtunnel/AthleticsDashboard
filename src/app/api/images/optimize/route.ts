import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");
    const width = searchParams.get("w") ? parseInt(searchParams.get("w")!) : undefined;
    const height = searchParams.get("h") ? parseInt(searchParams.get("h")!) : undefined;
    const quality = searchParams.get("q") ? parseInt(searchParams.get("q")!) : 80;
    const format = searchParams.get("format") || "png";

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Missing image URL parameter" },
        { status: 400 }
      );
    }

    // Only allow optimization for local images (uploaded signatures)
    if (!imageUrl.startsWith("/uploads/")) {
      return NextResponse.json(
        { error: "Only local images can be optimized" },
        { status: 400 }
      );
    }

    // Remove query string from URL (e.g., cache busting ?v=123)
    const cleanImageUrl = imageUrl.split("?")[0];

    // Construct file path
    const imagePath = path.join(process.cwd(), "public", cleanImageUrl);
    
    // Check if file exists
    if (!existsSync(imagePath)) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    // Read and process image
    const imageBuffer = await readFile(imagePath);
    
    // Create Sharp instance and apply transformations
    let sharpInstance = sharp(imageBuffer);
    
    // Apply resizing if dimensions specified
    if (width || height) {
      sharpInstance = sharpInstance.resize({
        width: width || undefined,
        height: height || undefined,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    
    // Apply format conversion and quality
    switch (format) {
      case "webp":
        sharpInstance = sharpInstance.webp({ quality });
        break;
      case "jpeg":
        sharpInstance = sharpInstance.jpeg({ quality });
        break;
      case "png":
        sharpInstance = sharpInstance.png({ quality: Math.round((quality / 100) * 9) });
        break;
      case "avif":
        sharpInstance = sharpInstance.avif({ quality });
        break;
      default:
        sharpInstance = sharpInstance.webp({ quality });
    }

    // Get processed buffer
    const optimizedBuffer = await sharpInstance.toBuffer();
    
    // Set appropriate content type
    const contentType = `image/${format}`;
    
    // Return optimized image
    return new NextResponse(optimizedBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": optimizedBuffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable", // 1 year cache
      },
    });
  } catch (error) {
    console.error("Image optimization error:", error);
    // Fallback: serve original image if optimization fails
    try {
      const { searchParams } = new URL(request.url);
      const imageUrl = searchParams.get("url");
      if (imageUrl) {
        const cleanImageUrl = imageUrl.split("?")[0];
        const imagePath = path.join(process.cwd(), "public", cleanImageUrl);
        if (existsSync(imagePath)) {
          const originalBuffer = await readFile(imagePath);
          // Determine content type from file extension
          const ext = path.extname(cleanImageUrl).toLowerCase();
          const contentTypeMap: Record<string, string> = {
            ".webp": "image/webp",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
          };
          const contentType = contentTypeMap[ext] || "application/octet-stream";
          return new NextResponse(originalBuffer, {
            headers: {
              "Content-Type": contentType,
              "Content-Length": originalBuffer.length.toString(),
              "Cache-Control": "public, max-age=86400", // 1 day cache for fallback
            },
          });
        }
      }
    } catch (fallbackError) {
      console.error("Fallback image serving also failed:", fallbackError);
    }
    return NextResponse.json(
      { error: "Failed to optimize image" },
      { status: 500 }
    );
  }
}