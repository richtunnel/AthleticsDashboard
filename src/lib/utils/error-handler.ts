import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { headers } from "next/headers";
import { logger } from "./logger";

export async function handleApiError(error: unknown, context?: any) {
  const headersList = await headers();
  const requestId = headersList.get("x-request-id") || "unknown";

  logger.error(`API Error - RequestID: ${requestId}`, {
    error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    ...context,
    timestamp: new Date().toISOString(),
  });

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation error",
        details: error.issues,
        requestId,
      },
      { status: 400 }
    );
  }

  // Handle custom errors with status codes
  if (error instanceof Error || (typeof error === "object" && error !== null && "message" in error)) {
    const message = (error as any).message || "An error occurred";

    // Determine status code based on error message or error properties
    let status = (error as any).status || (error as any).statusCode || 500;
    
    if (status === 500 || !status) {
      if (message.includes("Unauthorized") || message.includes("not authenticated")) {
        status = 401;
      } else if (message.includes("Forbidden") || message.includes("access denied")) {
        status = 403;
      } else if (message.includes("not found")) {
        status = 404;
      } else if (message.includes("required") || message.includes("invalid") || message.includes("limit exceeded")) {
        status = 400;
      } else if (message.includes("Duplicate")) {
        status = 409;
      } else if (message.includes("misconfigured")) {
        status = 500;
      }
    }

    return NextResponse.json(
      { 
        success: false, 
        error: message,
        requestId 
      }, 
      { status }
    );
  }

  // Handle string errors
  if (typeof error === "string") {
    return NextResponse.json(
      {
        success: false,
        error,
        requestId
      },
      { status: 500 }
    );
  }

  // Default error response
  return NextResponse.json(
    { 
      success: false, 
      error: "An unexpected error occurred",
      requestId 
    }, 
    { status: 500 }
  );
}
