/**
 * Secure API Route Example
 *
 * This file demonstrates best practices for implementing a secure API endpoint
 * using the security utilities provided in the Opletics application.
 *
 * NOTE: This is an example file and does not use actual Prisma models.
 * Replace 'prisma.resource' with actual models from your Prisma schema.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import {
  rateLimit,
  RateLimitConfig,
  getClientIp,
} from "@/lib/security/rate-limiter";
import {
  applyAllSecurityHeaders,
} from "@/lib/security/security-headers";
import {
  withIdempotency,
  getIdempotencyKeyFromRequest,
} from "@/lib/security/idempotency";
import {
  sanitizeEmail,
  sanitizeString,
  validatePassword,
} from "@/lib/security/sanitizer";

/**
 * POST - Create a new resource with full security measures
 *
 * This example shows how to properly secure a POST endpoint with:
 * - Rate limiting
 * - Authentication
 * - Input sanitization
 * - Validation
 * - Idempotency
 * - Security headers
 */
export async function POST(request: NextRequest) {
  // 1. Apply Rate Limiting
  // Prevents abuse and DoS attacks
  const { allowed: rateLimitAllowed, retryAfter } = await rateLimit(
    request,
    RateLimitConfig.userApi // 100 requests per 15 minutes
  );

  if (!rateLimitAllowed) {
    const response = NextResponse.json(
      {
        error: "Too many requests",
        message: `Please try again in ${retryAfter} seconds`,
      },
      { status: 429 }
    );
    response.headers.set("Retry-After", retryAfter?.toString() || "900");
    return applyAllSecurityHeaders(request, response);
  }

  // 2. Apply Idempotency
  // Prevents duplicate processing of the same request
  const idempotencyKey = getIdempotencyKeyFromRequest(request);

  if (!idempotencyKey) {
    const response = NextResponse.json(
      {
        error: "Idempotency key required",
        message:
          "This operation requires an Idempotency-Key header to prevent duplicate processing",
      },
      { status: 400 }
    );
    return applyAllSecurityHeaders(request, response);
  }

  // 3. Wrap handler with idempotency
  // This will cache the response and replay it for identical keys
  return withIdempotency(
    request,
    async () => {
      try {
        // 4. Authenticate User
        // Ensures only authorized users can access this endpoint
        const session = await requireAuth();
        const userId = session.user.id;
        const clientIp = getClientIp(request);

        console.log("[API] Creating resource for user:", userId, "from IP:", clientIp);

        // 5. Parse and Validate Request Body
        const body = await request.json();

        // 6. Sanitize Inputs
        // Prevents XSS and injection attacks
        const sanitizedName = sanitizeString(body.name || "");
        const sanitizedEmail = sanitizeEmail(body.email || "");
        const sanitizedDescription = body.description
          ? sanitizeString(body.description)
          : undefined;

        if (!sanitizedName || !sanitizedEmail) {
          const response = NextResponse.json(
            {
              error: "Invalid input",
              message: "Name and email are required and must be valid",
            },
            { status: 400 }
          );
          return applyAllSecurityHeaders(request, response);
        }

        // 7. Validate email format
        if (!sanitizedEmail) {
          const response = NextResponse.json(
            {
              error: "Invalid email",
              message: "Please provide a valid email address",
            },
            { status: 400 }
          );
          return applyAllSecurityHeaders(request, response);
        }

        // 8. Check for duplicates using Prisma
        // Parameterized query prevents SQL injection
        // NOTE: Replace with your actual Prisma model
        // const existing = await prisma.user.findUnique({
        //   where: { email: sanitizedEmail },
        // });

        // if (existing) {
        //   // Use constant-time response to prevent email enumeration
        //   const response = NextResponse.json(
        //     {
        //       error: "Resource already exists",
        //       message: "A resource with this email already exists",
        //     },
        //     { status: 409 }
        //   );
        //   return applyAllSecurityHeaders(request, response);
        // }

        // 9. Create Resource using Prisma
        // All queries are parameterized - no SQL injection risk
        // NOTE: Replace with your actual Prisma model and fields
        /*
        const resource = await prisma.yourModel.create({
          data: {
            name: sanitizedName,
            email: sanitizedEmail,
            description: sanitizedDescription,
            userId: userId,
            organizationId: session.user.organizationId,
          },
          // Only select needed fields - never return sensitive data
          select: {
            id: true,
            name: true,
            email: true,
            description: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        console.log("[API] Resource created:", resource.id, "for user:", userId);

        // 10. Return Success Response with Security Headers
        const response = NextResponse.json(
          {
            success: true,
            data: resource,
          },
          { status: 201 }
        );
        return applyAllSecurityHeaders(request, response);
        */

        // Example response for demonstration
        const response = NextResponse.json(
          {
            success: true,
            message: "Example secure endpoint - implement with your Prisma model",
            data: {
              id: "example-id",
              name: sanitizedName,
              email: sanitizedEmail,
            },
          },
          { status: 201 }
        );
        return applyAllSecurityHeaders(request, response);

      } catch (error) {
        console.error("[API] Error creating resource:", error);

        // 11. Return Error Response with Security Headers
        // Never expose internal implementation details
        const response = NextResponse.json(
          {
            error: "Failed to create resource",
            message: "An error occurred while processing your request",
          },
          { status: 500 }
        );
        return applyAllSecurityHeaders(request, response);
      }
    },
    {
      requireKey: true,
      expiryMs: 24 * 60 * 60 * 1000, // 24 hours
      userId: (await requireAuth()).user.id, // Use user ID for more precise limiting
    }
  );
}

/**
 * GET - Fetch resources with security
 *
 * This example shows how to properly secure a GET endpoint with:
 * - Rate limiting
 * - Authentication
 * - Security headers
 * - Pagination
 */
export async function GET(request: NextRequest) {
  // 1. Rate Limiting
  const { allowed: rateLimitAllowed, retryAfter } = await rateLimit(
    request,
    RateLimitConfig.userApi
  );

  if (!rateLimitAllowed) {
    const response = NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
    response.headers.set("Retry-After", retryAfter?.toString() || "900");
    return applyAllSecurityHeaders(request, response);
  }

  try {
    // 2. Authenticate
    const session = await requireAuth();

    // 3. Fetch data with pagination
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");

    // Use parameterized query via Prisma
    // NOTE: Replace with your actual Prisma model
    /*
    const resources = await prisma.yourModel.findMany({
      where: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
      },
      // Only select public/safe fields
      select: {
        id: true,
        name: true,
        email: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 4. Return with security headers
    const response = NextResponse.json({
      success: true,
      data: resources,
      pagination: {
        page,
        limit,
      },
    });
    return applyAllSecurityHeaders(request, response);
    */

    // Example response for demonstration
    const response = NextResponse.json({
      success: true,
      message: "Example secure endpoint - implement with your Prisma model",
      data: [],
      pagination: { page, limit },
    });
    return applyAllSecurityHeaders(request, response);

  } catch (error) {
    console.error("[API] Error fetching resources:", error);
    const response = NextResponse.json(
      { error: "Failed to fetch resources" },
      { status: 500 }
    );
    return applyAllSecurityHeaders(request, response);
  }
}

/**
 * DELETE - Delete a resource with security
 *
 * This example shows how to properly secure a DELETE endpoint with:
 * - Rate limiting (stricter for destructive operations)
 * - Authentication
 * - Authorization/ownership checks
 * - Security headers
 */
export async function DELETE(request: NextRequest) {
  // 1. Rate Limiting (stricter for destructive operations)
  const { allowed: rateLimitAllowed, retryAfter } = await rateLimit(
    request,
    RateLimitConfig.userApiStrict // Stricter limit for destructive operations
  );

  if (!rateLimitAllowed) {
    const response = NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
    response.headers.set("Retry-After", retryAfter?.toString() || "900");
    return applyAllSecurityHeaders(request, response);
  }

  try {
    // 2. Authenticate
    const session = await requireAuth();

    // 3. Get resource ID from URL
    const url = new URL(request.url);
    const resourceId = url.pathname.split("/").pop();

    if (!resourceId) {
      const response = NextResponse.json(
        { error: "Resource ID required" },
        { status: 400 }
      );
      return applyAllSecurityHeaders(request, response);
    }

    // 4. Verify ownership (authorization check)
    // NOTE: Replace with your actual Prisma model
    /*
    const resource = await prisma.yourModel.findUnique({
      where: { id: resourceId },
      select: {
        id: true,
        userId: true,
        organizationId: true,
      },
    });

    if (!resource) {
      const response = NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
      return applyAllSecurityHeaders(request, response);
    }

    // 5. Check if user owns this resource
    if (
      resource.userId !== session.user.id ||
      resource.organizationId !== session.user.organizationId
    ) {
      const response = NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
      return applyAllSecurityHeaders(request, response);
    }

    // 6. Delete resource
    await prisma.yourModel.delete({
      where: { id: resourceId },
    });

    console.log("[API] Resource deleted:", resourceId, "by user:", session.user.id);
    */

    // 7. Return success
    const response = NextResponse.json({
      success: true,
      message: "Resource deleted successfully",
    });
    return applyAllSecurityHeaders(request, response);

  } catch (error) {
    console.error("[API] Error deleting resource:", error);
    const response = NextResponse.json(
      { error: "Failed to delete resource" },
      { status: 500 }
    );
    return applyAllSecurityHeaders(request, response);
  }
}

/**
 * Security Checklist for API Routes:
 *
 * ✓ Apply rate limiting
 * ✓ Apply security headers
 * ✓ Require authentication
 * ✓ Sanitize all inputs
 * ✓ Validate with schema (Zod)
 * ✓ Use parameterized queries (Prisma)
 * ✓ Check authorization/ownership
 * ✓ Return appropriate HTTP status codes
 * ✓ Never expose sensitive data in errors
 * ✓ Apply idempotency for state-changing operations
 * ✓ Log security events appropriately
 *
 * Best Practices:
 *
 * 1. Always use parameterized queries via Prisma - never concatenate user input
 * 2. Sanitize all user inputs before processing
 * 3. Never log or expose sensitive data (passwords, tokens)
 * 4. Return consistent error messages to prevent information leakage
 * 5. Apply rate limiting to prevent abuse and DoS attacks
 * 6. Use constant-time comparisons for security tokens
 * 7. Validate on both client and server (client is UX, server is security)
 * 8. Keep dependencies updated for security patches
 * 9. Review security logs regularly
 * 10. Use HTTPS in production with valid SSL certificate
 */
