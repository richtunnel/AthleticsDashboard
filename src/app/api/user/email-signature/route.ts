import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";

export async function GET() {
  try {
    const session = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        signaturePhone: true,
        signatureWebsite: true,
        signatureLogoUrl: true,
        signatureText: true,
      } as any,
    }) as any;

    if (!user) {
      return ApiResponse.error("User not found", 404);
    }

    const response = ApiResponse.success({
      signaturePhone: user.signaturePhone || "",
      signatureWebsite: user.signatureWebsite || "",
      signatureLogoUrl: user.signatureLogoUrl || "",
      signatureText: user.signatureText || "",
    });

    // Add cache control headers to prevent stale data
    response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");

    return response;
  } catch (error) {
    return await handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { signaturePhone, signatureWebsite, signatureLogoUrl, signatureText } = body;

    // Validate inputs
    if (signaturePhone && typeof signaturePhone !== "string") {
      return ApiResponse.error("Invalid phone number format");
    }

    if (signatureWebsite && typeof signatureWebsite !== "string") {
      return ApiResponse.error("Invalid website format");
    }

    if (signatureLogoUrl && typeof signatureLogoUrl !== "string") {
      return ApiResponse.error("Invalid logo URL format");
    }

    if (signatureText && typeof signatureText !== "string") {
      return ApiResponse.error("Invalid signature text format");
    }

    // Optional: Validate URL format
    if (signatureWebsite && signatureWebsite.trim()) {
      try {
        new URL(signatureWebsite);
      } catch {
        return ApiResponse.error("Invalid website URL format. Please include http:// or https://");
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        signaturePhone: signaturePhone || null,
        signatureWebsite: signatureWebsite || null,
        signatureLogoUrl: signatureLogoUrl || null,
        signatureText: signatureText || null,
      } as any,
      select: {
        signaturePhone: true,
        signatureWebsite: true,
        signatureLogoUrl: true,
        signatureText: true,
      } as any,
    }) as any;

    return ApiResponse.success({
      message: "Email signature updated successfully",
      signature: updatedUser,
    });
  } catch (error) {
    return await handleApiError(error);
  }
}
