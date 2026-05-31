import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * S3 / DigitalOcean Spaces client.
 *
 * Single source of truth: DO_SPACES_* env vars only. No legacy fallbacks.
 *
 * Required
 * ────────
 *   DO_SPACES_BUCKET         e.g. opletics-main-bucket
 *   DO_SPACES_REGION         e.g. atl1
 *   DO_SPACES_ACCESS_KEY_ID  the access key ID from DO (looks like DO80XXXXXXXXXXXXXXXX)
 *   DO_SPACES_SECRET_KEY     the matching secret (only shown once at creation)
 *
 * Optional
 * ────────
 *   DO_SPACES_ENDPOINT          defaults to https://{bucket}.{region}.digitaloceanspaces.com
 *   DO_SPACES_CDN_URL           defaults to https://{bucket}.{region}.cdn.digitaloceanspaces.com
 *   DO_SPACES_FORCE_PATH_STYLE  "true" if your endpoint requires path-style addressing
 */

const env = (key: string): string => {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : "";
};

export const SPACES_BUCKET = env("DO_SPACES_BUCKET");
const SPACES_REGION = env("DO_SPACES_REGION") || "atl1";
const ACCESS_KEY = env("DO_SPACES_ACCESS_KEY_ID");
const SECRET_KEY = env("DO_SPACES_SECRET_KEY");

function buildEndpoint(rawUrl: string): string {
  let url = rawUrl.replace(/\/$/, "");
  if (!url.startsWith("http://") && !url.startsWith("https://")) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    if (hostname.startsWith(`${SPACES_BUCKET}.`)) {
      parsed.hostname = hostname.slice(SPACES_BUCKET.length + 1);
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.replace(`://${SPACES_BUCKET}.`, "://");
  }
}

const rawEndpoint =
  env("DO_SPACES_ENDPOINT") ||
  (SPACES_BUCKET ? `https://${SPACES_BUCKET}.${SPACES_REGION}.digitaloceanspaces.com` : "");

const rawCdnUrl =
  env("DO_SPACES_CDN_URL") ||
  (SPACES_BUCKET ? `https://${SPACES_BUCKET}.${SPACES_REGION}.cdn.digitaloceanspaces.com` : "");

export const SPACES_ENDPOINT = rawEndpoint ? buildEndpoint(rawEndpoint) : "";
export const SPACES_CDN_URL = rawCdnUrl.replace(/\/$/, "");
export const FORCE_PATH_STYLE = env("DO_SPACES_FORCE_PATH_STYLE") === "true";

/**
 * True only when every required piece of Spaces config is present.
 * Use this in route handlers instead of inlining the same check everywhere.
 */
export const S3_CONFIGURED = Boolean(
  SPACES_BUCKET && SPACES_ENDPOINT && ACCESS_KEY && SECRET_KEY
);

export const s3Client = new S3Client({
  endpoint: SPACES_ENDPOINT || undefined,
  region: SPACES_REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
  forcePathStyle: FORCE_PATH_STYLE,
  // AWS SDK v3's default of "WHEN_SUPPORTED" injects an
  // `x-amz-checksum-crc32` query parameter into presigned URLs. DigitalOcean
  // Spaces rejects the upload because the client never sends that header but
  // the parameter is inside the signature scope. "WHEN_REQUIRED" disables the
  // auto-injection so presigned PUTs work cleanly against Spaces.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

// Log once at module load so misconfiguration is obvious in startup logs.
// Lists the EXACT four env var names the code reads — no ambiguity.
if (!S3_CONFIGURED && process.env.NODE_ENV === "production") {
  // eslint-disable-next-line no-console
  console.warn(
    "[s3] Spaces NOT configured — image uploads will fail. " +
      "Required env vars: DO_SPACES_BUCKET, DO_SPACES_REGION, " +
      "DO_SPACES_ACCESS_KEY_ID, DO_SPACES_SECRET_KEY."
  );
}

export { PutObjectCommand, DeleteObjectCommand };
