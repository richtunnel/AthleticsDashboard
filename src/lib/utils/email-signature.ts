import { getSiteUrl } from "./siteUrl";

interface SignatureData {
  signaturePhone?: string | null;
  signatureWebsite?: string | null;
  signatureLogoUrl?: string | null;
  signatureText?: string | null;
}

interface BuildEmailSignatureOptions {
  /** Optional base URL for resolving relative image paths. If not provided, will use server-side getSiteUrl() */
  baseUrl?: string;
  /** Whether to use optimized image URLs (for email preview). Defaults to false for actual emails */
  useOptimizedImages?: boolean;
  /** Optional custom colors for dark mode support in previews */
  colors?: {
    primary?: string;
    secondary?: string;
    link?: string;
    divider?: string;
  };
}

/** Escape HTML special characters to prevent XSS */
function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";

  const escapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return text.replace(/[&<>"']/g, (char) => escapeMap[char]);
}

/** Check if URL is absolute (http/https) */
function isAbsoluteUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

/** Resolve relative URLs to absolute URLs */
function resolveUrl(url: string, baseUrl: string): string {
  if (isAbsoluteUrl(url)) return url;

  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
}

/**
 * Get optimized image URL for previews
 * Used for faster loading in browser previews
 */
function getOptimizedImageUrl(imageUrl: string, baseUrl?: string): string {
  try {
    const params = new URLSearchParams({
      url: imageUrl,
      w: "120",
      h: "120",
      format: "png",
    });
    const relativeUrl = `/api/images/optimize?${params.toString()}`;
    if (baseUrl) {
      return resolveUrl(relativeUrl, baseUrl);
    }
    return relativeUrl;
  } catch {
    return imageUrl;
  }
}

/**
 * Process and normalize logo URL for emails
 * Ensures consistent URL resolution across all contexts
 */
function processLogoUrl(logoUrl: string, baseUrl: string, useOptimized: boolean = false): string {
  if (!logoUrl?.trim()) return "";

  let processed = logoUrl.trim();

  // If already an optimized URL, extract the actual image URL for processing
  if (processed.includes("/api/images/optimize")) {
    try {
      // Handle both absolute and relative optimization URLs
      const urlObj = processed.startsWith("http") 
        ? new URL(processed) 
        : new URL(processed, "http://localhost");
      
      const actualUrl = urlObj.searchParams.get("url");
      if (actualUrl) {
        processed = actualUrl;
      }
    } catch {
      console.warn("[EMAIL-SIG] Failed to parse optimized image URL, using original");
    }
  }

  // Detect if this is a local image (uploaded to /uploads/)
  let isLocalImage = false;
  let localPath = "";

  if (processed.startsWith("/uploads/")) {
    // Relative local path
    isLocalImage = true;
    localPath = processed;
  } else {
    // Check if it's an absolute URL pointing to this site's /uploads/
    try {
      if (isAbsoluteUrl(processed)) {
        const urlObj = new URL(processed);
        const baseUrlObj = new URL(baseUrl);
        if (urlObj.origin === baseUrlObj.origin && urlObj.pathname.startsWith("/uploads/")) {
          isLocalImage = true;
          localPath = urlObj.pathname;
        }
      }
    } catch {
      // Not a valid URL, treat as-is
    }
  }

  // Return optimized URL for previews (only for local images), or absolute URL for emails
  if (useOptimized && isLocalImage && localPath) {
    return getOptimizedImageUrl(localPath, baseUrl);
  }

  // Convert relative URLs to absolute
  if (!isAbsoluteUrl(processed)) {
    processed = resolveUrl(processed, baseUrl);
  }

  return processed;
}

/**
 * Build email signature HTML with consistent image handling
 *
 * @param signatureData The signature data object
 * @param options Configuration options:
 *   - baseUrl: Base URL for resolving relative paths (defaults to getSiteUrl())
 *   - useOptimizedImages: Whether to use optimized image URLs (for previews). Defaults to false for production emails.
 *
 * @returns HTML string for email signature or preview
 */
export function buildEmailSignatureHTML(signatureData: SignatureData, options: BuildEmailSignatureOptions = {}): string {
  const { signaturePhone, signatureWebsite, signatureLogoUrl, signatureText } = signatureData;

  // Early return if no signature data
  if (!signaturePhone && !signatureWebsite && !signatureLogoUrl && !signatureText) {
    return "";
  }

  const baseUrl = options.baseUrl || getSiteUrl();
  const useOptimized = options.useOptimizedImages ?? false;

  // Use custom colors if provided (for dark mode previews), otherwise use default email-safe colors
  const colors = options.colors || {};
  const primaryColor = colors.primary || "#1f2937";
  const secondaryColor = colors.secondary || "#374151";
  const linkColor = colors.link || "#2563eb";
  const dividerColor = colors.divider || "#e5e7eb";

  const sections: string[] = [];

  // Process logo with consistent URL resolution
  if (signatureLogoUrl?.trim()) {
    try {
      const logoUrl = processLogoUrl(signatureLogoUrl, baseUrl, useOptimized);

      if (logoUrl) {
        sections.push(`<img src="${escapeHtml(logoUrl)}" alt="Company Logo" width="120" height="120" style="max-width: 120px; max-height: 120px; width: 120px; height: auto; display: block; margin-bottom: 12px; border-radius: 4px;" />`);
      }
    } catch (error) {
      console.error("[EMAIL-SIG] Error processing signature logo:", error);
    }
  }

  // Collect text content
  const textContent: string[] = [];

  if (signatureText?.trim()) {
    textContent.push(`<div style="margin-bottom: 8px; white-space: pre-wrap; font-size: 14px; line-height: 1.5;">${escapeHtml(signatureText)}</div>`);
  }

  if (signaturePhone?.trim()) {
    textContent.push(`<div style="margin-bottom: 6px; font-size: 14px; color: ${secondaryColor};">${escapeHtml(signaturePhone)}</div>`);
  }

  if (signatureWebsite?.trim()) {
    const website = signatureWebsite.trim();
    // Ensure website has protocol for href
    const websiteHref = website.startsWith("http") ? website : `https://${website}`;
    textContent.push(
      `<div style="margin-bottom: 6px; font-size: 14px;"><a href="${escapeHtml(websiteHref)}" style="color: ${linkColor}; text-decoration: none; font-weight: 500;">${escapeHtml(website)}</a></div>`,
    );
  }

  if (textContent.length > 0) {
    sections.push(`<div style="font-size: 14px; color: ${secondaryColor}; line-height: 1.6;">${textContent.join("")}</div>`);
  }

  return `<div style="margin-top: 24px; padding-top: 20px; border-top: 2px solid ${dividerColor}; font-family: Arial, sans-serif; color: ${primaryColor};">${sections.join("")}</div>`;
}

/**
 * Validate if a URL appears to be accessible
 * Used for client-side preview validation
 */
export function isValidImageUrl(url: string): boolean {
  if (!url?.trim()) return false;

  try {
    // Check if it's a valid URL format
    new URL(url.startsWith("http") ? url : `https://${url}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get optimized image URL for display
 * Exported for use in components that show image previews
 */
export function getSignatureLogoPreviewUrl(imageUrl: string, baseUrl?: string): string {
  if (!imageUrl?.trim()) return "";

  const resolvedBase = baseUrl || getSiteUrl();
  return processLogoUrl(imageUrl, resolvedBase, true);
}
