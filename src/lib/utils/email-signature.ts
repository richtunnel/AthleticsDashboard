interface SignatureData {
  signaturePhone?: string | null;
  signatureWebsite?: string | null;
  signatureLogoUrl?: string | null;
  signatureText?: string | null;
}

export function buildEmailSignatureHTML(signatureData: SignatureData): string {
  const { signaturePhone, signatureWebsite, signatureLogoUrl, signatureText } = signatureData;

  // Return empty string if no signature data
  if (!signaturePhone && !signatureWebsite && !signatureLogoUrl && !signatureText) {
    return "";
  }

  let html = '<div style="margin-top: 24px; padding-top: 20px; border-top: 2px solid #e5e7eb; font-family: Arial, sans-serif;">';

  // Add logo if present
  if (signatureLogoUrl) {
    html += `<img src="${signatureLogoUrl}" alt="Logo" style="max-width: 120px; max-height: 120px; display: block; margin-bottom: 12px;" />`;
  }

  html += '<div style="font-size: 14px; color: #374151; line-height: 1.6;">';

  // Add custom text if present
  if (signatureText) {
    html += `<div style="margin-bottom: 8px; white-space: pre-wrap;">${escapeHtml(signatureText)}</div>`;
  }

  // Add phone if present (no icon)
  if (signaturePhone) {
    html += `<div style="margin-bottom: 6px;">${escapeHtml(signaturePhone)}</div>`;
  }

  // Add website if present (no icon)
  if (signatureWebsite) {
    html += `<div style="margin-bottom: 6px;"><a href="${escapeHtml(signatureWebsite)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(signatureWebsite)}</a></div>`;
  }

  html += '</div></div>';

  return html;
}

function escapeHtml(text: string | null | undefined): string {
  if (text === null || text === undefined) {
    return "";
  }
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
