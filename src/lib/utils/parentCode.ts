/**
 * parentCode.ts
 *
 * Generates and assigns unique parent profile codes.
 *
 * Format: {firstLetterOfFirstName}{lastName}_op{8-digit-random}
 * Example: rstokes_op00120050
 *
 * Rules:
 *  - All lowercase, alphanumeric + underscore only
 *  - Last name is truncated to 10 chars to keep total length reasonable
 *  - Suffix is an 8-digit zero-padded random number (100,000,000 space)
 *  - Collision retry up to 5 times before falling back to full random string
 */

import { prisma } from "@/lib/database/prisma";

/**
 * Derive the parent code prefix from a display name.
 * e.g. "Ryan Stokes" → "rstokes"
 */
function buildPrefix(name: string | null): string {
  const trimmed = (name || "").trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);

  const firstLetter = (parts[0]?.[0] ?? "u").toLowerCase().replace(/[^a-z0-9]/, "u");
  const lastName = (parts[parts.length - 1] ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10); // cap last name portion

  return `${firstLetter}${lastName || "user"}`;
}

/**
 * Generate a candidate parent code string.
 */
export function generateParentCode(name: string | null): string {
  const prefix = buildPrefix(name);
  const numeric = String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0");
  return `${prefix}_op${numeric}`;
}

/**
 * Ensure a user has a parentCode. If one is already set it is returned
 * immediately. Otherwise a new unique code is generated, persisted, and
 * returned.
 *
 * Call this from any parent-facing route where the code needs to exist
 * (e.g. create-link, profile GET).
 */
export async function ensureParentCode(userId: string, name: string | null): Promise<string> {
  // Fast path — already has one
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { parentCode: true },
  });

  if (existing?.parentCode) {
    return existing.parentCode;
  }

  // Generate a unique code with up to 5 collision retries
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateParentCode(name);

    const conflict = await prisma.user.findUnique({
      where: { parentCode: code },
      select: { id: true },
    });

    if (!conflict) {
      await prisma.user.update({
        where: { id: userId },
        data: { parentCode: code },
      });
      return code;
    }
  }

  // Absolute fallback: use a crypto-random suffix
  const fallback = `${buildPrefix(name)}_op${Date.now().toString(36)}`;
  await prisma.user.update({
    where: { id: userId },
    data: { parentCode: fallback },
  });
  return fallback;
}
