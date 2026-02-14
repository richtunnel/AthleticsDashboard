# Digital Ocean Spaces Setup Guide

This guide explains how to configure and use Digital Ocean Spaces for image/asset storage with optimal caching.

## Configuration

### 1. Create a Digital Ocean Space

1. Go to [Digital Ocean Spaces](https://cloud.digitalocean.com/spaces)
2. Click "Create Space"
3. Choose a region (e.g., `nyc3`, `sfo3`, `ams3`, `sgp1`, `fra1`)
4. Enable CDN for better global performance
5. Set the space to **Public** (for public image serving)

### 2. Generate API Keys

1. Go to **API** in the left sidebar
2. Under "Spaces access keys", click "Generate New Key"
3. Note down the **Key** (access key ID) and **Secret** (secret access key)

### 3. Environment Variables

Add the following to your `.env` file:

```bash
# Required
SPACES_BUCKET="your-bucket-name"
SPACES_REGION="nyc3"
SPACES_ACCESS_KEY_ID="your-access-key-id"
SPACES_SECRET_ACCESS_KEY="your-secret-access-key"

# Optional - for CDN acceleration
SPACES_CDN_ENDPOINT="https://your-bucket.nyc3.cdn.digitaloceanspaces.com"
```

## Usage

### Server-Side Upload

```typescript
import { uploadToSpaces, generatePath } from "@/lib/spaces";

// Basic upload
const result = await uploadToSpaces("logo.png", buffer, {
  contentType: "image/png",
  isPublic: true,
});

console.log(result.url);     // Direct Spaces URL
console.log(result.cdnUrl);  // CDN URL (if configured)
console.log(result.etag);    // ETag for cache validation

// With organization scoping (recommended)
const filename = generatePath(
  organizationId,
  "team-logos",
  teamId,
  "logo.png",
  { versioned: true, buffer }
);

const result = await uploadToSpaces(filename, buffer, {
  contentType: "image/png",
  skipIfUnchanged: true,  // Avoid duplicate uploads
  metadata: {
    "team-id": teamId,
    "uploaded-by": userId,
  },
});
```

### Client-Side Upload (React Hook)

```typescript
import { useImageUpload } from "@/hooks/useImageUpload";

function ImageUploader() {
  const { upload, isUploading, error } = useImageUpload();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await upload(file, {
        entityType: "team-logo",
        optimize: true,
        maxWidth: 800,
        quality: 85,
      });

      console.log("Uploaded to:", result.url);
      console.log("From cache?", result.source === "cache");
    } catch (err) {
      // Error handled via hook
    }
  };

  return (
    <input
      type="file"
      accept="image/*"
      onChange={handleFileChange}
      disabled={isUploading}
    />
  );
}
```

### Using with Next.js Image

The Next.js config is already set up to allow Spaces CDN domains:

```tsx
import Image from "next/image";

// Use CDN URL for best performance
<Image
  src={imageUrl}  // Spaces CDN URL from upload result
  alt="Description"
  width={400}
  height={300}
  priority={false}
/>
```

## Caching Strategy

### How It Works

1. **Content Hashing**: Every upload generates a SHA-256 hash of the file content
2. **Versioned Filenames**: Files include a content hash (e.g., `logo.va1b2c3d4e5f6.png`)
3. **Immutable Headers**: Cache-Control set to `public, max-age=31536000, immutable`
4. **ETag Support**: Each object has an ETag for conditional requests
5. **Deduplication**: `skipIfUnchanged` option prevents redundant uploads

### Cache Invalidation

Since we use content-based hashing in filenames, cache invalidation happens automatically when the file content changes. The old URL continues to work (immutable caching) but new content gets a new URL.

```
Original: logo.png -> logo.va1b2c3d4e5f6.png
Modified: logo.png -> logo.vf7e8d9c0b1a2.png
```

### Checking Cache Status

```typescript
import { headObject, getCachedUrl } from "@/lib/spaces";

// Check if file exists and get metadata
const info = await headObject("path/to/file.png");

if (info.exists) {
  console.log("ETag:", info.etag);
  console.log("Last Modified:", info.lastModified);
  console.log("Content Hash:", info.metadata?.["content-hash"]);
}

// Quick cache check
const cachedUrl = await getCachedUrl("path/to/file.png");
if (cachedUrl) {
  console.log("File exists at:", cachedUrl);
}
```

## API Route

The `POST /api/upload/image` endpoint handles:

- File validation (size, type)
- Storage quota checks
- Image optimization with Sharp (if available)
- Deduplication via content hashing
- Organization-scoped paths

### Request

```bash
curl -X POST /api/upload/image \
  -F "file=@photo.jpg" \
  -F "entityType=team-photos" \
  -F "optimize=true" \
  -F "maxWidth=1200" \
  -F "quality=85"
```

### Response

```json
{
  "success": true,
  "url": "https://cdn.digitaloceanspaces.com/org-123/team-photos/user-456/1699999999999_photo.va1b2c3d4e5f6.webp",
  "source": "upload",
  "optimized": true,
  "dimensions": { "width": 1200, "height": 800 },
  "size": { "bytes": 125000, "formatted": "122.07 KB" }
}
```

## Migration from Local Storage

If you have existing local uploads, you can migrate them:

```typescript
import { uploadToSpaces, generatePath } from "@/lib/spaces";
import { readFile } from "fs/promises";
import { glob } from "glob";

async function migrateLocalToSpaces(organizationId: string) {
  const localFiles = await glob("public/uploads/**/*");

  for (const localPath of localFiles) {
    const buffer = await readFile(localPath);
    const filename = localPath.split("/").pop()!;

    const spacesPath = generatePath(
      organizationId,
      "migrated",
      "batch-1",
      filename,
      { versioned: true, buffer }
    );

    const result = await uploadToSpaces(spacesPath, buffer);
    console.log(`Migrated ${filename} -> ${result.cdnUrl}`);
  }
}
```

## Best Practices

1. **Always use versioned filenames** for cache-busting
2. **Use CDN URL** for serving images (faster global delivery)
3. **Enable `skipIfUnchanged`** to avoid paying for duplicate uploads
4. **Set appropriate metadata** for debugging and organization
5. **Use organization-scoped paths** for multi-tenant separation
6. **Optimize images before upload** to reduce bandwidth and storage costs

## Troubleshooting

### Upload fails with 401/403

- Verify `SPACES_ACCESS_KEY_ID` and `SPACES_SECRET_ACCESS_KEY`
- Check that the Space is configured for public reads (if serving images)

### Images not showing

- Ensure `SPACES_CDN_ENDPOINT` is set correctly
- Check Next.js `remotePatterns` config includes the CDN domain

### High storage costs

- Enable `skipIfUnchanged` to deduplicate uploads
- Use image optimization to reduce file sizes
- Set up lifecycle policies in Digital Ocean to delete old versions
