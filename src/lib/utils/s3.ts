import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const SPACES_BUCKET = process.env.DO_SPACES_BUCKET || "";
const SPACES_REGION = process.env.DO_SPACES_REGION || "atl1";

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
  process.env.DO_SPACES_ENDPOINT ||
  `https://${SPACES_BUCKET}.${SPACES_REGION}.digitaloceanspaces.com`;

const rawCdnUrl =
  process.env.DO_SPACES_CDN_URL ||
  `https://${SPACES_BUCKET}.${SPACES_REGION}.cdn.digitaloceanspaces.com`;

export const SPACES_ENDPOINT = buildEndpoint(rawEndpoint);
export const SPACES_CDN_URL = rawCdnUrl.replace(/\/$/, "");
export const FORCE_PATH_STYLE = process.env.DO_SPACES_FORCE_PATH_STYLE === "true";

export const s3Client = new S3Client({
  endpoint: SPACES_ENDPOINT,
  region: SPACES_REGION,
  credentials: {
    accessKeyId:
      process.env.DO_SPACES_ACCESS_KEY ||
      process.env.DO_SPACES_ACCESS_KEY_NAME ||
      "",
    secretAccessKey: process.env.DO_SPACES_SECRET_KEY || "",
  },
  forcePathStyle: FORCE_PATH_STYLE,
});

export { PutObjectCommand, DeleteObjectCommand };
