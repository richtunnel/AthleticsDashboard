import { prisma } from "@/lib/database/prisma";
import { NextResponse } from "next/server";
import { rateLimit, RateLimitConfig, getClientIp } from "@/lib/security/rate-limiter";
import { applyAllSecurityHeaders } from "@/lib/security/security-headers";
import { sanitizeEmail } from "@/lib/security/sanitizer";

export async function POST(req: Request) {
  // Apply rate limiting - strict limit for email checking to prevent enumeration attacks
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                 req.headers.get('x-real-ip') ||
                 'unknown';

  const { allowed: rateLimitAllowed, retryAfter } = await rateLimit(
    req as any,
    RateLimitConfig.auth
  );

  if (!rateLimitAllowed) {
    const response = NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
    response.headers.set('Retry-After', retryAfter?.toString() || '900');
    return applyAllSecurityHeaders(req as any, response);
  }

  try {
    const { email } = await req.json();

    const sanitizedEmail = sanitizeEmail(email);

    if (!sanitizedEmail) {
      const response = NextResponse.json(
        { error: "Valid email required" },
        { status: 400 }
      );
      return applyAllSecurityHeaders(req as any, response);
    }

    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail.toLowerCase() },
    });

    // Use constant-time response to prevent email enumeration timing attacks
    const response = NextResponse.json({ exists: !!user });
    return applyAllSecurityHeaders(req as any, response);
  } catch (error) {
    console.error("[User Exists API] Error:", error);
    const response = NextResponse.json(
      { error: "Failed to check email" },
      { status: 500 }
    );
    return applyAllSecurityHeaders(req as any, response);
  }
}
