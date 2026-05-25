/**
 * Configure CORS on the DigitalOcean Spaces bucket so the browser can PUT
 * files directly to it via presigned URLs.
 *
 * Run once after creating the bucket (or any time you add a new domain):
 *
 *   npm install   # ensure deps
 *   npx tsx src/scripts/configure-spaces-cors.ts
 *
 * Env vars required (same names the rest of the app uses):
 *   SPACES_BUCKET       (or DO_SPACES_BUCKET)
 *   SPACES_ACCESS_KEY   (or DO_SPACES_ACCESS_KEY)
 *   SPACES_SECRET_KEY   (or DO_SPACES_SECRET_KEY)
 *   SPACES_ENDPOINT     (or DO_SPACES_ENDPOINT)  — optional, derived if missing
 *   SPACES_REGION       (or DO_SPACES_REGION)    — optional, default "atl1"
 *
 * Allowed origins are read from CORS_ALLOWED_ORIGINS as a comma-separated list,
 * e.g. CORS_ALLOWED_ORIGINS="https://opletics.com,https://www.opletics.com,http://localhost:3000"
 * Defaults to opletics.com + www + localhost:3000 if unset.
 */

import { PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { s3Client, SPACES_BUCKET, S3_CONFIGURED } from "../lib/utils/s3";

async function main() {
  if (!S3_CONFIGURED) {
    console.error(
      "[configure-spaces-cors] S3 is not configured. " +
        "Set SPACES_BUCKET, SPACES_ACCESS_KEY, SPACES_SECRET_KEY, and SPACES_ENDPOINT."
    );
    process.exit(1);
  }

  const origins = (
    process.env.CORS_ALLOWED_ORIGINS ||
    "https://opletics.com,https://www.opletics.com,http://localhost:3000"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  console.log(`[configure-spaces-cors] bucket: ${SPACES_BUCKET}`);
  console.log(`[configure-spaces-cors] allowed origins:`);
  origins.forEach((o) => console.log(`  • ${o}`));

  const cmd = new PutBucketCorsCommand({
    Bucket: SPACES_BUCKET,
    CORSConfiguration: {
      CORSRules: [
        {
          // Browser uploads happen via PUT to presigned URLs. GET/HEAD let the
          // CDN serve images cross-origin (e.g. embedded in <img> tags).
          AllowedMethods: ["PUT", "GET", "HEAD"],
          AllowedOrigins: origins,
          // Headers the browser is allowed to send on the PUT
          AllowedHeaders: [
            "content-type",
            "content-length",
            "x-amz-acl",
            "x-amz-date",
            "authorization",
          ],
          // Headers the browser is allowed to read from the response
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3000,
        },
      ],
    },
  });

  try {
    await s3Client.send(cmd);
    console.log("[configure-spaces-cors] ✓ CORS configured successfully");
  } catch (err: any) {
    console.error("[configure-spaces-cors] ✗ Failed:", err?.message || err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[configure-spaces-cors] fatal:", err);
  process.exit(1);
});
