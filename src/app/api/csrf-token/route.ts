import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { generateCsrfToken } from "@/lib/csrf";

/**
 * GET /api/csrf-token
 * Returns a CSRF token for the current session
 */
export async function GET() {
  try {
    const session = await requireAuth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const token = generateCsrfToken(session.user.id);
    
    return NextResponse.json({
      success: true,
      token,
    });
  } catch (error) {
    console.error("[CSRF Token API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate CSRF token" },
      { status: 500 }
    );
  }
}
