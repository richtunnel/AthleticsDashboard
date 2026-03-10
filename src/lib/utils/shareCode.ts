import { prisma } from "@/lib/database/prisma";

const SHARE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding confusing chars like 0/O, 1/I
const SHARE_CODE_LENGTH = 8;
const MAX_ATTEMPTS = 10;

/**
 * Generate a random share code string (not guaranteed unique)
 */
export function generateShareCode(): string {
  let code = "";
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
    code += SHARE_CODE_CHARS.charAt(
      Math.floor(Math.random() * SHARE_CODE_CHARS.length)
    );
  }
  return code;
}

/**
 * Generate a unique share code by checking for collisions in the database.
 * Returns the unique code, or null if unable to generate one after MAX_ATTEMPTS.
 */
export async function generateUniqueShareCode(): Promise<string | null> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const code = generateShareCode();
    const existing = await prisma.user.findUnique({
      where: { shareCode: code },
    });
    if (!existing) {
      return code;
    }
  }
  return null;
}
