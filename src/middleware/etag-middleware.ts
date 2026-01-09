import { NextRequest, NextResponse } from "next/server";
import { generateETag, checkETagMatch } from "@/lib/utils/etag";
import { existsSync, readFileSync } from "fs";
import * as path from "path";

/**
 * Middleware for handling ETag validation for static assets
 */
export function etagMiddleware(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  
  // Only handle image requests
  if (!isImageRequest(pathname)) {
    return null;
  }
  
  // Get the file path
  const filePath = path.join(process.cwd(), "public", pathname);
  
  // Check if file exists
  if (!existsSync(filePath)) {
    return null;
  }
  
  try {
    const fileBuffer = readFileSync(filePath);
    const etag = generateETag(fileBuffer);
    const ifNoneMatch = request.headers.get("if-none-match");
    
    // Check if ETag matches
    if (checkETagMatch(etag, ifNoneMatch)) {
      return new NextResponse(null, { status: 304 });
    }
    
    // Add ETag header to the response
    const response = NextResponse.next();
    response.headers.set("ETag", etag);
    return response;
  } catch (error) {
    console.error("ETag middleware error:", error);
    return null;
  }
}

function isImageRequest(pathname: string): boolean {
  return ["jpg", "jpeg", "png", "gif", "webp", "avif"].some((ext) => 
    pathname.endsWith(`.${ext}`)
  );
}