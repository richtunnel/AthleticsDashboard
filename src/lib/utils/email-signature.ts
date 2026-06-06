import { getSiteUrl } from "./siteUrl";

interface SignatureData {
  signaturePhone?: string | null;
  signatureWebsite?: string | null;
  signatureLogoUrl?: string | null;
  signatureText?: string | null;
  /** Custom disclaimer text; null = use the default auto-generated one */
  signatureDisclaimer?: string | null;
  /** Whether to append the disclaimer to outgoing emails */
  signatureDisclaimerEnabled?: boolean | null;
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
      w: "80",
      h: "80",
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
export function processLogoUrl(logoUrl: string, baseUrl: string, useOptimized: boolean = false): string {
  if (!logoUrl?.trim()) return "";

  let processed = logoUrl.trim();

  // 1. Handle already optimized URLs - extract the original source URL
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
      // Failed to parse, continue with original
    }
  }

  // 2. Identify the type of URL
  const isAbsolute = isAbsoluteUrl(processed);
  const isDigitalOcean = processed.includes("digitaloceanspaces.com");
  const isVercelBlob = processed.includes("vercel-storage.com");
  const isRemoteStorage = isDigitalOcean || isVercelBlob;

  // 3. For remote storage (Digital Ocean), they are already optimized and absolute.
  // We return them as-is even if useOptimized is true to avoid double-processing
  // through the local optimization proxy which might not have access to these buckets.
  if (isRemoteStorage && isAbsolute) {
    return processed;
  }

  // 4. Detect if this is a local image (uploaded to /uploads/)
  let isLocalImage = false;
  let localPath = "";

  if (processed.startsWith("/uploads/")) {
    // Relative local path
    isLocalImage = true;
    localPath = processed;
  } else if (isAbsolute) {
    // Check if it's an absolute URL pointing to this site's /uploads/
    try {
      const urlObj = new URL(processed);
      const baseUrlObj = new URL(baseUrl);
      if (urlObj.origin === baseUrlObj.origin && urlObj.pathname.startsWith("/uploads/")) {
        isLocalImage = true;
        localPath = urlObj.pathname;
      }
    } catch {
      // Not a valid URL, treat as-is
    }
  }

  // 5. Apply optimization for local images in preview mode
  if (useOptimized && isLocalImage && localPath) {
    return getOptimizedImageUrl(localPath, baseUrl);
  }

  // 6. Ensure all relative URLs are converted to absolute for email compatibility
  if (!isAbsolute) {
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
  const { signaturePhone, signatureWebsite, signatureLogoUrl, signatureText, signatureDisclaimer, signatureDisclaimerEnabled } = signatureData;

  // Early return if no signature data
  if (!signaturePhone && !signatureWebsite && !signatureLogoUrl && !signatureText && !signatureDisclaimerEnabled) {
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
        // 40×40 px: compact size suitable for email signatures; explicit HTML
        // attributes ensure email clients that ignore CSS still render correctly.
        sections.push(`<img src="${escapeHtml(logoUrl)}" alt="Company Logo" width="40" height="40" style="width: 40px; max-width: 40px; height: auto; display: block; margin-bottom: 6px; border-radius: 3px; border: 0;" />`);
      }
    } catch (error) {
      console.error("[EMAIL-SIG] Error processing signature logo:", error);
    }
  }

  // Collect text content - using tighter spacing for professional business signatures
  const textContent: string[] = [];

  if (signatureText?.trim()) {
    // signatureText may contain rich HTML (bold/size from the editor) or legacy plain text.
    const isHtmlContent = /<[a-z][\s\S]*?>/i.test(signatureText);
    const rendered = isHtmlContent ? signatureText : escapeHtml(signatureText).replace(/\n/g, "<br>");
    textContent.push(`<div style="margin-bottom: 4px; font-size: 14px; line-height: 1.4;">${rendered}</div>`);
  }

  if (signaturePhone?.trim()) {
    // Format as (xxx)xxx-xxxx when it's a standard 10-digit US number; otherwise
    // keep whatever the user typed. The href uses RFC 3966 tel: with digits
    // only (plus optional leading +) so dialers parse it reliably.
    const rawPhone = signaturePhone.trim();
    const digits = rawPhone.replace(/\D/g, "");
    const formattedPhone =
      digits.length === 10
        ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6)}`
        : digits.length === 11 && digits.startsWith("1")
        ? `(${digits.slice(1, 4)}) ${digits.slice(4, 7)} - ${digits.slice(7)}`
        : rawPhone;
    const telHref =
      digits.length >= 10
        ? `tel:+${digits.startsWith("1") ? digits : `1${digits}`}`
        : `tel:${digits}`;
    textContent.push(
      `<div style="margin-bottom: 2px; font-size: 13px; line-height: 1.3;"><a href="${escapeHtml(telHref)}" style="color: ${secondaryColor}; text-decoration: none;">${escapeHtml(formattedPhone)}</a></div>`
    );
  }

  if (signatureWebsite?.trim()) {
    const website = signatureWebsite.trim();
    // Ensure website has protocol for href
    const websiteHref = website.startsWith("http") ? website : `https://${website}`;
    textContent.push(
      `<div style="margin-bottom: 2px; font-size: 13px; line-height: 1.3;"><a href="${escapeHtml(websiteHref)}" style="color: ${linkColor}; text-decoration: none; font-weight: 500;">${escapeHtml(website)}</a></div>`,
    );
  }

  if (textContent.length > 0) {
    sections.push(`<div style="font-size: 13px; color: ${secondaryColor}; line-height: 1.3;">${textContent.join("")}</div>`);
  }

  // ── Disclaimer ─────────────────────────────────────────────────────────────
  if (signatureDisclaimerEnabled) {
    const disclaimerText = signatureDisclaimer?.trim() || "";
    if (disclaimerText) {
      sections.push(
        `<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid ${dividerColor}; font-size: 10px; color: #9ca3af; line-height: 1.5; font-style: italic;">${escapeHtml(disclaimerText)}</div>`
      );
    }
  }

  return `<div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid ${dividerColor}; font-family: Arial, sans-serif; color: ${primaryColor};">${sections.join("")}</div>`;
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
