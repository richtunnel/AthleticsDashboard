import { prisma } from "@/lib/database/prisma";
import { isSameDay, startOfDay } from "date-fns";

const GEOLOCATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CacheEntry {
  city: string | null;
  expiresAt: number;
}

const geolocationCache = new Map<string, CacheEntry>();
let geoApiWarningLogged = false;

export type LoginTrackingPayload = {
  userId: string;
  provider: string;
  ip?: string | null;
  userAgent?: string | null;
};

export async function recordUserLogin({
  userId,
  provider,
  ip,
  userAgent,
}: LoginTrackingPayload): Promise<void> {
  if (!userId) {
    return;
  }

  const now = new Date();
  const startOfToday = startOfDay(now);
  const normalizedIp = normalizeIp(ip);
  let resolvedCity: string | null = null;

  if (normalizedIp) {
    try {
      resolvedCity = await resolveCityForIp(normalizedIp);
    } catch (error) {
      console.warn("Failed to resolve geolocation for IP", {
        ip: normalizedIp,
        error,
      });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.userLoginEvent.create({
        data: {
          userId,
          provider,
          ip: normalizedIp,
          city: resolvedCity,
          userAgent: userAgent ?? null,
        },
      });

      const existing = await tx.user.findUnique({
        where: { id: userId },
        select: {
          lastLoginDate: true,
          dailyLoginCount: true,
        },
      });

      const isSameDayLogin = existing?.lastLoginDate ? isSameDay(existing.lastLoginDate, now) : false;
      const updatedDailyCount = isSameDayLogin ? (existing?.dailyLoginCount ?? 0) + 1 : 1;

      await tx.user.update({
        where: { id: userId },
        data: {
          lastLoginAt: now,
          lastLoginDate: startOfToday,
          dailyLoginCount: updatedDailyCount,
          ...(resolvedCity ? { city: resolvedCity } : {}),
        },
      });
    });
  } catch (error) {
    console.error("Failed to persist login tracking details", {
      userId,
      error,
    });
  }
}

export async function getRecentLoginEvents(userId: string, limit = 20) {
  return prisma.userLoginEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getLoginSummary(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      lastLoginAt: true,
      lastLoginDate: true,
      dailyLoginCount: true,
      city: true,
    },
  });
}

function normalizeIp(rawIp?: string | null): string | null {
  if (!rawIp) {
    return null;
  }

  const primary = rawIp
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)[0];

  if (!primary || primary.toLowerCase() === "unknown") {
    return null;
  }

  const cleaned = primary.startsWith("::ffff:") ? primary.replace("::ffff:", "") : primary;

  if (cleaned === "::1" || cleaned === "localhost") {
    return null;
  }

  if (!cleaned.includes(":") && isPrivateIpv4(cleaned)) {
    return null;
  }

  return cleaned;
}

function isPrivateIpv4(ip: string): boolean {
  if (!ip) {
    return true;
  }

  return (
    ip === "127.0.0.1" ||
    ip === "0.0.0.0" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("169.254.") ||
    isIn172PrivateRange(ip)
  );
}

function isIn172PrivateRange(ip: string): boolean {
  if (!ip.startsWith("172.")) {
    return false;
  }

  const parts = ip.split(".");
  const secondOctet = parts.length > 1 ? Number(parts[1]) : NaN;
  return !Number.isNaN(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
}

async function resolveCityForIp(ip: string): Promise<string | null> {
  const cached = geolocationCache.get(ip);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.city;
  }

  const apiKey = process.env.IPINFO_API_TOKEN;

  if (!apiKey) {
    if (!geoApiWarningLogged) {
      console.warn("IPINFO_API_TOKEN is not configured. Geolocation will be skipped.");
      geoApiWarningLogged = true;
    }
    geolocationCache.set(ip, { city: null, expiresAt: now + GEOLOCATION_CACHE_TTL_MS });
    return null;
  }

  try {
    const response = await fetch(`https://ipinfo.io/${ip}?token=${apiKey}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("IP geolocation lookup failed", {
        ip,
        status: response.status,
        statusText: response.statusText,
      });
      geolocationCache.set(ip, { city: null, expiresAt: now + GEOLOCATION_CACHE_TTL_MS });
      return null;
    }

    const payload = (await response.json()) as { city?: string | null };
    const city = payload.city?.trim() || null;

    geolocationCache.set(ip, { city, expiresAt: now + GEOLOCATION_CACHE_TTL_MS });
    return city;
  } catch (error) {
    console.warn("IP geolocation request failed", { ip, error });
    geolocationCache.set(ip, { city: null, expiresAt: now + GEOLOCATION_CACHE_TTL_MS });
    return null;
  }
}
