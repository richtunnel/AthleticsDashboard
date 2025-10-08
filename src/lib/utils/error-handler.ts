import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function handleApiError(error: unknown) {
  console.error("API Error:", error);

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation error",
        details: error,
      },
      { status: 400 }
    );
  }

  // Handle custom errors with status codes
  if (error instanceof Error) {
    const message = error.message;

    // Determine status code based on error message
    let status = 500;
    if (message.includes("Unauthorized") || message.includes("not authenticated")) {
      status = 401;
    } else if (message.includes("Forbidden") || message.includes("access denied")) {
      status = 403;
    } else if (message.includes("not found")) {
      status = 404;
    } else if (message.includes("required") || message.includes("invalid")) {
      status = 400;
    }

    return NextResponse.json({ success: false, error: message }, { status });
  }

  // Default error response
  return NextResponse.json({ success: false, error: "An unexpected error occurred" }, { status: 500 });
}
