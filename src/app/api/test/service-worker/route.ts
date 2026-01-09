import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Generate a test image response that should be cached by service worker
    const testImageBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    return new NextResponse(testImageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
        "ETag": '"test-etag-123"',
        "Content-Length": testImageBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Service worker test error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}