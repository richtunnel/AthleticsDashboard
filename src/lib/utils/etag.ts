import { createHash } from "crypto";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * Generate ETag for a file or buffer
 * @param content File buffer or path to file
 * @returns ETag string
 */
export function generateETag(content: Buffer | string): string {
  let buffer: Buffer;
  
  if (typeof content === "string") {
    // Content is a file path
    buffer = readFileSync(content);
  } else {
    // Content is already a buffer
    buffer = content;
  }
  
  const hash = createHash("md5").update(buffer).digest("hex");
  return `"${hash}"`;
}

/**
 * Check if ETag matches
 * @param etag Current ETag
 * @param ifNoneMatch If-None-Match header value
 * @returns True if ETags match
 */
export function checkETagMatch(etag: string, ifNoneMatch: string | null): boolean {
  if (!ifNoneMatch) return false;
  
  // Handle multiple ETags in If-None-Match header
  const etags = ifNoneMatch.split(",").map((e) => e.trim());
  return etags.includes(etag);
}