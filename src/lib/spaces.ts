import crypto from "crypto";

interface UploadOptions {
  /** Content type of the file (auto-detected if not provided) */
  contentType?: string;
  /** Custom metadata to store with the object */
  metadata?: Record<string, string>;
  /** Cache duration in seconds (default: 1 year for immutable assets) */
  cacheDuration?: number;
  /** Whether to make the object publicly readable */
  isPublic?: boolean;
  /** If true, checks if file exists and only uploads if content changed */
  skipIfUnchanged?: boolean;
  /** Optional width/height for image metadata */
  dimensions?: { width: number; height: number };
}

interface UploadResult {
  url: string;
  cdnUrl: string;
  etag: string;
  contentHash: string;
  lastModified: Date;
  isCached: boolean;
  size: number;
}

interface HeadResult {
  exists: boolean;
  etag?: string;
  lastModified?: Date;
  contentLength?: number;
  contentType?: string;
  metadata?: Record<string, string>;
}

const SPACES_CONFIG = {
  bucket: process.env.SPACES_BUCKET || "",
  region: process.env.SPACES_REGION || "nyc3",
  endpoint: process.env.SPACES_ENDPOINT || "digitaloceanspaces.com",
  accessKeyId: process.env.SPACES_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.SPACES_SECRET_ACCESS_KEY || "",
  cdnEndpoint: process.env.SPACES_CDN_ENDPOINT || "",
};

/**
 * Default MIME type detection based on file extension
 */
function detectContentType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    avif: "image/avif",
    heic: "image/heic",
    heif: "image/heif",
    bmp: "image/bmp",
    tiff: "image/tiff",
    ico: "image/x-icon",
    pdf: "application/pdf",
    json: "application/json",
    xml: "application/xml",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}

/**
 * Generate SHA-256 hash of content for integrity checking
 */
function generateContentHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Generate short hash for filename versioning (first 12 chars of SHA-256)
 */
function generateVersionHash(buffer: Buffer): string {
  return generateContentHash(buffer).slice(0, 12);
}

/**
 * Build Spaces URL
 */
function buildSpacesUrl(filename: string): string {
  return `https://${SPACES_CONFIG.bucket}.${SPACES_CONFIG.region}.${SPACES_CONFIG.endpoint}/${filename}`;
}

/**
 * Build CDN URL (if configured, otherwise falls back to Spaces URL)
 */
function buildCdnUrl(filename: string): string {
  if (SPACES_CONFIG.cdnEndpoint) {
    return `${SPACES_CONFIG.cdnEndpoint}/${filename}`;
  }
  return buildSpacesUrl(filename);
}

/**
 * Parse AWS S3/Spaces response headers into metadata
 */
function parseMetadata(headers: Headers): Record<string, string> {
  const metadata: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (key.startsWith("x-amz-meta-")) {
      metadata[key.replace("x-amz-meta-", "")] = value;
    }
  });
  return metadata;
}

/**
 * Check if object exists and get its metadata
 * Uses HEAD request for efficient checking without downloading content
 */
export async function headObject(filename: string): Promise<HeadResult> {
  const url = buildSpacesUrl(filename);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${SPACES_CONFIG.accessKeyId}:${SPACES_CONFIG.secretAccessKey}`,
      },
    });

    if (response.status === 404) {
      return { exists: false };
    }

    if (!response.ok) {
      throw new Error(`HEAD request failed: ${response.status} ${response.statusText}`);
    }

    const etag = response.headers.get("etag")?.replace(/"/g, "");
    const lastModified = response.headers.get("last-modified");
    const contentLength = response.headers.get("content-length");
    const contentType = response.headers.get("content-type") || undefined;

    return {
      exists: true,
      etag: etag || undefined,
      lastModified: lastModified ? new Date(lastModified) : undefined,
      contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
      contentType,
      metadata: parseMetadata(response.headers),
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return { exists: false };
    }
    throw error;
  }
}

/**
 * Upload a file to Digital Ocean Spaces with intelligent caching
 *
 * Features:
 * - Content-based cache busting via ETag
 * - Automatic content-type detection
 * - Optional skip-if-unchanged to avoid redundant uploads
 * - Immutable caching headers for optimal CDN performance
 * - Dual URL return (origin + CDN)
 *
 * Cache Strategy:
 * - Uses `Cache-Control: public, max-age=31536000, immutable` for versioned assets
 * - Uses `ETag` for conditional requests and cache validation
 * - Content hash stored in metadata for integrity verification
 */
export async function uploadToSpaces(
  filename: string,
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const {
    contentType = detectContentType(filename),
    metadata = {},
    cacheDuration = 31536000, // 1 year default for immutable assets
    isPublic = true,
    skipIfUnchanged = false,
    dimensions,
  } = options;

  // Validate configuration
  if (!SPACES_CONFIG.bucket || !SPACES_CONFIG.accessKeyId) {
    throw new Error("Spaces configuration missing. Check SPACES_BUCKET and SPACES_ACCESS_KEY_ID env vars.");
  }

  // Generate content hash for integrity and comparison
  const contentHash = generateContentHash(buffer);

  // If skipIfUnchanged is enabled, check if file exists with same content
  if (skipIfUnchanged) {
    const existing = await headObject(filename);

    if (existing.exists && existing.metadata?.["content-hash"] === contentHash) {
      // File exists with identical content, return cached info
      return {
        url: buildSpacesUrl(filename),
        cdnUrl: buildCdnUrl(filename),
        etag: existing.etag || contentHash,
        contentHash,
        lastModified: existing.lastModified || new Date(),
        isCached: true,
        size: existing.contentLength || buffer.length,
      };
    }
  }

  const url = buildSpacesUrl(filename);

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": buffer.length.toString(),
    // Cache headers for optimal CDN performance
    "Cache-Control": isPublic
      ? `public, max-age=${cacheDuration}, immutable`
      : `private, max-age=${cacheDuration}`,
    // Content hash for integrity verification
    "x-amz-meta-content-hash": contentHash,
    "x-amz-meta-uploaded-at": new Date().toISOString(),
  };

  // Add dimensions metadata for images
  if (dimensions) {
    headers["x-amz-meta-width"] = dimensions.width.toString();
    headers["x-amz-meta-height"] = dimensions.height.toString();
  }

  // Add custom metadata
  Object.entries(metadata).forEach(([key, value]) => {
    if (!key.startsWith("x-amz-")) {
      headers[`x-amz-meta-${key}`] = value;
    }
  });

  // Digital Ocean Spaces uses AWS Signature V4 or pre-signed URLs
  // For simplicity and direct REST API usage, we use the Bearer token approach
  // In production, consider using AWS SDK for complex operations
  if (SPACES_CONFIG.accessKeyId && SPACES_CONFIG.secretAccessKey) {
    headers["Authorization"] = `Bearer ${SPACES_CONFIG.accessKeyId}:${SPACES_CONFIG.secretAccessKey}`;
  }

  // Upload with retry logic
  let lastError: Error | null = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "PUT",
        headers,
        body: buffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed (${response.status}): ${errorText}`);
      }

      const etag = response.headers.get("etag")?.replace(/"/g, "") || contentHash;
      const lastModified = response.headers.get("last-modified");

      return {
        url: buildSpacesUrl(filename),
        cdnUrl: buildCdnUrl(filename),
        etag,
        contentHash,
        lastModified: lastModified ? new Date(lastModified) : new Date(),
        isCached: false,
        size: buffer.length,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on client errors (4xx)
      if (lastError.message.match(/4\d\d/)) {
        throw lastError;
      }

      // Exponential backoff: 100ms, 200ms, 400ms
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastError || new Error("Upload failed after retries");
}

/**
 * Delete an object from Spaces
 */
export async function deleteFromSpaces(filename: string): Promise<void> {
  const url = buildSpacesUrl(filename);

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SPACES_CONFIG.accessKeyId}:${SPACES_CONFIG.secretAccessKey}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Generate a versioned filename with content hash
 * This enables cache-busting when content changes while maintaining immutable URLs
 *
 * Example: logo.png -> logo.v{hash}.png
 */
export function generateVersionedFilename(originalFilename: string, buffer: Buffer): string {
  const versionHash = generateVersionHash(buffer);
  const lastDot = originalFilename.lastIndexOf(".");

  if (lastDot === -1) {
    return `${originalFilename}.v${versionHash}`;
  }

  const name = originalFilename.slice(0, lastDot);
  const ext = originalFilename.slice(lastDot);
  return `${name}.v${versionHash}${ext}`;
}

/**
 * Generate a path-based filename with organization scoping
 */
export function generatePath(
  organizationId: string,
  entityType: string,
  entityId: string,
  originalFilename: string,
  options: { versioned?: boolean; buffer?: Buffer } = {}
): string {
  const timestamp = Date.now();
  const { versioned = false, buffer } = options;

  let filename = originalFilename;
  if (versioned && buffer) {
    filename = generateVersionedFilename(originalFilename, buffer);
  }

  // Sanitize filename: remove path traversal and special chars
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");

  return `${organizationId}/${entityType}/${entityId}/${timestamp}_${sanitized}`;
}

/**
 * Check if a cached version exists and is still valid
 * Returns the cached URL if valid, null if re-upload needed
 */
export async function getCachedUrl(
  filename: string,
  expectedHash?: string
): Promise<string | null> {
  const existing = await headObject(filename);

  if (!existing.exists) {
    return null;
  }

  // If expected hash provided, verify content hasn't changed
  if (expectedHash && existing.metadata?.["content-hash"] !== expectedHash) {
    return null;
  }

  return buildCdnUrl(filename);
}

/**
 * Get configuration status for health checks
 */
export function getSpacesConfig(): {
  isConfigured: boolean;
  bucket: string;
  region: string;
  hasCdn: boolean;
} {
  return {
    isConfigured: !!(SPACES_CONFIG.bucket && SPACES_CONFIG.accessKeyId && SPACES_CONFIG.secretAccessKey),
    bucket: SPACES_CONFIG.bucket,
    region: SPACES_CONFIG.region,
    hasCdn: !!SPACES_CONFIG.cdnEndpoint,
  };
}
