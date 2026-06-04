/**
 * Looks up the Unified School District for a US address using the
 * Census Bureau TIGER/Geocoder (free, no API key required).
 *
 * Layer 14 = Unified School Districts.
 * Returns title-cased district name, or null on any failure.
 */

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

/**
 * Parse a free-form US address into street / city / state components.
 * Handles common formats:
 *   "123 Main St, Dallas, TX 75201"
 *   "123 Main St, Dallas TX 75201"
 *   "123 Main St Dallas TX"
 */
function parseAddress(
  fullAddress: string
): { street: string; city: string; state: string } | null {
  const s = fullAddress.trim();

  // Primary: "Street, City, ST ZIPCODE" or "Street, City ST ZIPCODE"
  const primary = s.match(/^(.+?),\s*([^,]+?),?\s+([A-Z]{2})(?:\s+\d{5})?$/i);
  if (primary) {
    return {
      street: primary[1].trim(),
      city:   primary[2].trim(),
      state:  primary[3].toUpperCase(),
    };
  }

  // Fallback: split by commas, look for state in last segment
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const stateM = parts[parts.length - 1].match(/\b([A-Z]{2})\b/i);
    if (stateM) {
      return {
        street: parts[0],
        city:   parts[parts.length - 2],
        state:  stateM[1].toUpperCase(),
      };
    }
  }

  return null;
}

export async function lookupSchoolDistrict(
  fullAddress: string,
  timeoutMs = 6_000
): Promise<string | null> {
  const parsed = parseAddress(fullAddress);
  if (!parsed?.street || !parsed.city || !parsed.state) return null;

  const qs = new URLSearchParams({
    street:    parsed.street,
    city:      parsed.city,
    state:     parsed.state,
    benchmark: "Public_AR_Current",
    vintage:   "Current_Current",
    layers:    "14",
    format:    "json",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(
      `https://geocoding.geo.census.gov/geocoder/geographies/address?${qs}`,
      { signal: controller.signal, cache: "no-store" }
    );
    clearTimeout(timer);

    if (!res.ok) return null;

    const body = await res.json();
    const matches: any[] | undefined = body?.result?.addressMatches;
    if (!matches?.length) return null;

    const districts: any[] | undefined =
      matches[0]?.geographies?.["Unified School Districts"];
    if (!districts?.length) return null;

    const name: string | undefined = districts[0]?.NAME;
    return name ? toTitleCase(name) : null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}
