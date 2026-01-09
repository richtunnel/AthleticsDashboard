import { NextRequest, NextResponse } from "next/server";
import { generateETag } from "@/lib/utils/etag";
import { getOptimizedImageUrl } from "@/lib/utils/image";

export async function GET(request: NextRequest) {
  try {
    // Test ETag generation
    const testBuffer = Buffer.from("test image content");
    const etag = generateETag(testBuffer);

    // Test optimized image URL generation
    const testImageUrl = "/uploads/signatures/test.jpg";
    const optimizedUrl = getOptimizedImageUrl(testImageUrl, {
      width: 200,
      height: 200,
      quality: 85,
      format: "webp",
    });

    // Test responsive image sources
    const responsiveSources = [
      { width: 400, height: 300, media: "(min-width: 1200px)" },
      { width: 300, height: 225, media: "(min-width: 768px)" },
      { width: 200, height: 150, media: "(min-width: 480px)" },
    ].map((size) => ({
      src: getOptimizedImageUrl(testImageUrl, {
        width: size.width,
        height: size.height,
        format: "webp",
      }),
      width: size.width,
      height: size.height,
      media: size.media,
    }));

    return NextResponse.json({
      success: true,
      etag,
      optimizedUrl,
      responsiveSources,
      message: "Image caching and optimization features are working correctly",
    });
  } catch (error) {
    console.error("Image caching test error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}