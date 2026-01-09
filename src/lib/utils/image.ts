/**
 * Generate optimized image URL using the image optimization API
 * @param imageUrl Original image URL
 * @param options Optimization options
 * @returns Optimized image URL
 */
export function getOptimizedImageUrl(
  imageUrl: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: "webp" | "avif" | "jpeg" | "png";
  } = {}
): string {
  const { width, height, quality = 80, format = "webp" } = options;
  
  const params = new URLSearchParams();
  
  // Add image URL parameter
  params.append("url", imageUrl);
  
  // Add optimization parameters
  if (width) params.append("w", width.toString());
  if (height) params.append("h", height.toString());
  params.append("q", quality.toString());
  params.append("format", format);
  
  return `/api/images/optimize?${params.toString()}`;
}

/**
 * Get responsive image sources for different screen sizes
 * @param imageUrl Original image URL
 * @param sizes Array of size configurations
 * @returns Array of responsive image sources
 */
export function getResponsiveImageSources(
  imageUrl: string,
  sizes: Array<{
    width: number;
    height?: number;
    media?: string;
  }>
): Array<{
  src: string;
  width: number;
  height?: number;
  media?: string;
}> {
  return sizes.map((size) => ({
    src: getOptimizedImageUrl(imageUrl, {
      width: size.width,
      height: size.height,
      format: "webp",
    }),
    width: size.width,
    height: size.height,
    media: size.media,
  }));
}