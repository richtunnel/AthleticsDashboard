# Image Caching & Optimization Implementation

This document describes the comprehensive image caching and optimization system implemented for Opletics.com.

## Overview

The system includes the following key features:

1. **Sharp Image Optimization** - Server-side image processing with Sharp
2. **WebP Conversion** - Automatic conversion to modern WebP format
3. **Service Worker Caching** - Client-side caching with granular control
4. **URL Versioning** - Cache busting with content-based versioning
5. **ETag Support** - Conditional requests for bandwidth savings

## 1. Sharp Image Optimization

### API Endpoint

`GET /api/images/optimize`

### Parameters

- `url` (required): Original image URL (local or external)
- `w` (optional): Target width in pixels
- `h` (optional): Target height in pixels
- `q` (optional): Quality (1-100, default: 80)
- `format` (optional): Output format (webp, avif, jpeg, png, default: webp)

### Example Usage

```javascript
// Optimize an image to 300x200 WebP at 85% quality
const optimizedUrl = `/api/images/optimize?url=/uploads/signatures/logo.jpg&w=300&h=200&q=85&format=webp`;
```

### Features

- **Automatic WebP conversion** with quality optimization
- **Smart resizing** with aspect ratio preservation
- **Server-side caching** of optimized images
- **Support for multiple formats** (WebP, AVIF, JPEG, PNG)
- **External URL support** for third-party images

## 2. Service Worker Caching

### Service Worker Location

`/public/service-worker.js`

### Features

- **Automatic registration** in production environment
- **Image-specific caching** for uploads and optimized images
- **30-day cache lifetime** with automatic invalidation
- **Stale-while-revalidate** strategy for offline support
- **Background sync** for failed uploads
- **Periodic cache updates** (every 6 hours)

### Cached Resources

- `/uploads/signatures/` - User-uploaded signature images
- `/cache/images/` - Optimized image cache
- `/api/images/optimize` - Image optimization endpoint

### Service Worker Lifecycle

1. **Install**: Caches core assets and image directories
2. **Activate**: Cleans up old cache versions
3. **Fetch**: Intercepts image requests and serves from cache
4. **Sync**: Handles background synchronization of failed uploads

## 3. URL Versioning

### Implementation

URL versioning is implemented using content-based hashing:

```javascript
// Original: /uploads/signatures/logo.webp
// Versioned: /uploads/signatures/logo.webp?v=abc123def
```

### Benefits

- **Cache busting** when images are updated
- **Long-term caching** with immutable URLs
- **Content-based invalidation** using MD5 hashes
- **Backward compatibility** with existing URLs

### Example in Upload Endpoint

```typescript
// Generate versioned URL with content hash
const fileHash = createHash("md5").update(buffer).digest("hex").substring(0, 8);
const versionedUrl = `/uploads/signatures/${webpFilename}?v=${fileHash}`;
```

## 4. ETag Support

### Implementation

ETags are generated using MD5 hashes of image content:

```typescript
// Generate ETag
const etag = generateETag(imageBuffer); // Returns "abc123def"

// Check ETag match
if (checkETagMatch(etag, request.headers.get("if-none-match"))) {
  return new Response(null, { status: 304 }); // Not Modified
}
```

### Benefits

- **Bandwidth savings** - No re-download if content unchanged
- **HTTP caching compliance** - Standard conditional requests
- **Automatic validation** - Browser handles ETag comparison
- **Reduced server load** - Fewer full image downloads

### ETag Flow

1. Browser requests image with `If-None-Match: "abc123"`
2. Server compares ETags
3. If match: Returns `304 Not Modified`
4. If no match: Returns full image with new ETag

## 5. Utility Functions

### Image URL Generation

```typescript
import { getOptimizedImageUrl, getResponsiveImageSources } from "@/lib/utils/image";

// Single optimized image
const optimizedUrl = getOptimizedImageUrl("/uploads/logo.jpg", {
  width: 300,
  height: 200,
  quality: 85,
  format: "webp",
});

// Responsive image sources
const responsiveSources = getResponsiveImageSources("/uploads/logo.jpg", [
  { width: 600, height: 400, media: "(min-width: 1200px)" },
  { width: 400, height: 267, media: "(min-width: 768px)" },
  { width: 300, height: 200, media: "(min-width: 480px)" },
]);
```

### ETag Utilities

```typescript
import { generateETag, checkETagMatch } from "@/lib/utils/etag";

// Generate ETag for buffer
const etag = generateETag(imageBuffer);

// Check ETag match
const isMatch = checkETagMatch(etag, request.headers.get("if-none-match"));
```

## 6. Integration Examples

### React Component Usage

```jsx
import { getOptimizedImageUrl } from "@/lib/utils/image";

function LogoComponent({ logoUrl }) {
  const optimizedUrl = getOptimizedImageUrl(logoUrl, {
    width: 120,
    height: 120,
    format: "webp",
  });

  return (
    <img
      src={optimizedUrl}
      alt="Logo"
      loading="lazy"
      style={{ maxWidth: 120, maxHeight: 120 }}
    />
  );
}
```

### Responsive Picture Element

```jsx
const responsiveSources = getResponsiveImageSources(imageUrl, [
  { width: 800, media: "(min-width: 1200px)" },
  { width: 600, media: "(min-width: 768px)" },
  { width: 400, media: "(min-width: 480px)" },
]);

<picture>
  {responsiveSources.map((source) => (
    <source
      key={source.src}
      srcSet={source.src}
      media={source.media}
      width={source.width}
    />
  ))}
  <img
    src={getOptimizedImageUrl(imageUrl, { width: 400 })}
    alt="Responsive"
    loading="lazy"
  />
</picture>
```

## 7. Performance Benefits

### Bandwidth Savings

- **WebP conversion**: 25-35% smaller than JPEG/PNG
- **ETag validation**: Eliminates unnecessary re-downloads
- **Service worker caching**: Zero network requests for cached images

### Load Time Improvements

- **Instant loading**: Cached images load immediately
- **Reduced server load**: Fewer image processing requests
- **Better user experience**: Smooth image loading even on slow connections

### Storage Efficiency

- **Optimized storage**: WebP files are smaller
- **Automatic cleanup**: Service worker manages cache lifetime
- **Content-based versioning**: No duplicate caching of identical content

## 8. Testing

### Test Page

A comprehensive test page is available at `/test/image-caching` that demonstrates:

- ETag generation and validation
- Image optimization with different parameters
- Responsive image source generation
- Service worker registration status
- Cache invalidation features

### Test API Endpoint

`GET /api/test/image-caching` - Tests all image caching features

## 9. Configuration

### Next.js Configuration

```javascript
// next.config.ts
images: {
  formats: ["image/avif", "image/webp"],
  minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  dangerouslyAllowSVG: false,
  contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
}
```

### Security Headers

```javascript
// CSP includes worker and manifest support
"worker-src 'self' blob:",
"manifest-src 'self'"
```

## 10. Best Practices

### For Developers

1. **Always use optimized URLs** for images
2. **Include width/height parameters** for proper sizing
3. **Use WebP format** for best compression
4. **Add loading="lazy"** for offscreen images
5. **Test responsive sources** for different screen sizes

### For Content Creators

1. **Upload high-quality originals** - optimization handles the rest
2. **Use descriptive filenames** - helps with caching
3. **Avoid frequent updates** - versioning handles cache busting
4. **Test on different devices** - responsive images adapt automatically

## 11. Troubleshooting

### Common Issues

**Service Worker not registering**:
- Check browser console for errors
- Ensure HTTPS in production
- Verify manifest.json is accessible

**Images not optimizing**:
- Check API endpoint logs
- Verify Sharp is installed
- Ensure proper file permissions

**Cache not invalidating**:
- Check version parameter in URL
- Verify ETag headers
- Clear browser cache for testing

### Debugging Tools

- **Browser DevTools**: Network tab for cache headers
- **Lighthouse**: Performance audits
- **WebPageTest**: Real-world performance testing
- **Chrome Cache Inspector**: Service worker debugging

## 12. Future Enhancements

- **Automatic format selection** based on browser support
- **Progressive image loading** with blur-up placeholders
- **Advanced compression** with AVIF support
- **CDN integration** for global caching
- **Automatic image CDN** for external images

## Implementation Summary

This comprehensive image caching and optimization system provides:

✅ **25-35% bandwidth savings** through WebP conversion
✅ **Instant loading** with service worker caching
✅ **Automatic cache invalidation** with URL versioning
✅ **Bandwidth-efficient updates** with ETag support
✅ **Responsive image support** for all devices
✅ **Offline capability** with stale-while-revalidate
✅ **Developer-friendly utilities** for easy integration

The system is fully integrated with the existing Opletics platform and requires no changes to existing image upload workflows.