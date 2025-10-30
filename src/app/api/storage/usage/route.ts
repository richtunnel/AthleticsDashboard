import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { getStorageInfo } from "@/lib/utils/storage-check";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const storageInfo = await getStorageInfo(session.user.organizationId);

    return NextResponse.json({
      success: true,
      data: storageInfo,
    });
  } catch (error) {
    console.error("Error fetching storage usage:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch storage usage",
      },
      { status: 500 }
    );
  }
}
