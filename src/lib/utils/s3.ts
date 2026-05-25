import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * S3 / DigitalOcean Spaces client.
 *
 * Reads env vars in this priority order so the same code works regardless of
 * which naming convention the deployment uses:
 *
 *   1. DO_SPACES_*        — official DigitalOcean naming (preferred for clarity)
 *   2. SPACES_*           — short form used in docker-compose.yml
 *   3. AWS_S3_*           — falls back to standard AWS SDK names if you ever
 *                           migrate off Spaces to plain S3
 *
 * Examples
 * ────────
 *   SPACES_BUCKET=my-bucket           ← works
 *   DO_SPACES_BUCKET=my-bucket        ← also works
 *   AWS_S3_BUCKET=my-bucket           ← also works
 */

const env = (...keys: string[]): string => {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.trim()) return v.trim();
  }
  return "";
};

export const SPACES_BUCKET = env("DO_SPACES_BUCKET", "SPACES_BUCKET", "AWS_S3_BUCKET");
const SPACES_REGION = env("DO_SPACES_REGION", "SPACES_REGION", "AWS_S3_REGION") || "atl1";
const ACCESS_KEY = env(
  "DO_SPACES_ACCESS_KEY",
  "DO_SPACES_ACCESS_KEY_NAME",
  "SPACES_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID"
);
const SECRET_KEY = env(
  "DO_SPACES_SECRET_KEY",
  "SPACES_SECRET_KEY",
  "AWS_SECRET_ACCESS_KEY"
);

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
  env("DO_SPACES_ENDPOINT", "SPACES_ENDPOINT", "AWS_S3_ENDPOINT") ||
  (SPACES_BUCKET ? `https://${SPACES_BUCKET}.${SPACES_REGION}.digitaloceanspaces.com` : "");

const rawCdnUrl =
  env("DO_SPACES_CDN_URL", "SPACES_CDN_URL") ||
  (SPACES_BUCKET ? `https://${SPACES_BUCKET}.${SPACES_REGION}.cdn.digitaloceanspaces.com` : "");

export const SPACES_ENDPOINT = rawEndpoint ? buildEndpoint(rawEndpoint) : "";
export const SPACES_CDN_URL = rawCdnUrl.replace(/\/$/, "");
export const FORCE_PATH_STYLE =
  env("DO_SPACES_FORCE_PATH_STYLE", "SPACES_FORCE_PATH_STYLE") === "true";

/**
 * True only when every required piece of S3 config is present.
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
});

// Log once at module load so misconfiguration is obvious in startup logs
if (!S3_CONFIGURED && process.env.NODE_ENV === "production") {
  // eslint-disable-next-line no-console
  console.warn(
    "[s3] S3/Spaces NOT configured — image uploads will fail. " +
      "Required env: SPACES_BUCKET (or DO_SPACES_BUCKET), SPACES_ACCESS_KEY, " +
      "SPACES_SECRET_KEY, and SPACES_ENDPOINT or SPACES_REGION."
  );
}

export { PutObjectCommand, DeleteObjectCommand };
