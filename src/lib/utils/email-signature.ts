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

/** Process and normalize logo URL */
function processLogoUrl(logoUrl: string, baseUrl: string): string {
  let processed = logoUrl.trim();

  // Extract actual URL from optimized image API endpoint
  if (processed.startsWith("/api/images/optimize")) {
    try {
      const urlObj = new URL(processed, "http://localhost");
      const actualUrl = urlObj.searchParams.get("url");
      if (actualUrl) {
        processed = actualUrl;
      }
    } catch {
      console.warn("[EMAIL-SIG] Failed to parse optimized image URL");
    }
  }

  // Convert relative URLs to absolute
  if (!isAbsoluteUrl(processed)) {
    processed = resolveUrl(processed, baseUrl);
  }

  return processed;
}

export function buildEmailSignatureHTML(signatureData: SignatureData, options: BuildEmailSignatureOptions = {}): string {
  const { signaturePhone, signatureWebsite, signatureLogoUrl, signatureText } = signatureData;

  // Early return if no signature data
  if (!signaturePhone && !signatureWebsite && !signatureLogoUrl && !signatureText) {
    return "";
  }

  const baseUrl = options.baseUrl || getSiteUrl();

  const sections: string[] = [];

  // Process logo
  if (signatureLogoUrl?.trim()) {
    try {
      const logoUrl = processLogoUrl(signatureLogoUrl, baseUrl);
      sections.push(`<img src="${escapeHtml(logoUrl)}" alt="Logo" style="max-width: 120px; max-height: 120px; display: block; margin-bottom: 12px;" />`);
    } catch (error) {
      console.error("[EMAIL-SIG] Error processing signature logo:", error);
    }
  }

  // Collect text content
  const textContent: string[] = [];

  if (signatureText?.trim()) {
    textContent.push(`<div style="margin-bottom: 8px; white-space: pre-wrap;">${escapeHtml(signatureText)}</div>`);
  }

  if (signaturePhone?.trim()) {
    textContent.push(`<div style="margin-bottom: 6px;">${escapeHtml(signaturePhone)}</div>`);
  }

  if (signatureWebsite?.trim()) {
    const website = signatureWebsite.trim();
    textContent.push(`<div style="margin-bottom: 6px;"><a href="${escapeHtml(website)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(website)}</a></div>`);
  }

  if (textContent.length > 0) {
    sections.push(`<div style="font-size: 14px; color: #374151; line-height: 1.6;">${textContent.join("")}</div>`);
  }

  return `<div style="margin-top: 24px; padding-top: 20px; border-top: 2px solid #e5e7eb; font-family: Arial, sans-serif;">${sections.join("")}</div>`;
}
