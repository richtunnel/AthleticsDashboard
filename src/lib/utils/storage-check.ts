import { NextResponse } from "next/server";
import { checkStorageLimit, estimateDataSize, isUserOnFreePlan, formatBytes } from "@/lib/services/storage.service";

interface StorageCheckOptions {
  organizationId: string;
  userId: string;
  data?: any;
  estimatedSize?: number;
}

/**
 * Middleware function to check storage limits before creating/updating data
 * Returns an error response if storage limit is exceeded, otherwise returns null
 */
export async function checkStorageBeforeWrite(options: StorageCheckOptions): Promise<NextResponse | null> {
  const { organizationId, userId, data, estimatedSize } = options;

  // Only check for free plan users
  const isFreePlan = await isUserOnFreePlan(userId);
  if (!isFreePlan) {
    return null; // Paid plans have higher limits, skip check for now
  }

  // Estimate the size of the data being created
  const additionalBytes = estimatedSize || (data ? estimateDataSize(data) : 0);

  // Check if the operation would exceed the limit
  const storageCheck = await checkStorageLimit(organizationId, additionalBytes);

  if (!storageCheck.hasSpace) {
    return NextResponse.json(
      {
        success: false,
        error: "Storage limit exceeded",
        message: `Your organization has reached its storage limit of ${formatBytes(storageCheck.quota)}. You are currently using ${formatBytes(storageCheck.currentUsage)} (${storageCheck.percentUsed.toFixed(1)}%). Please upgrade your plan to continue adding data.`,
        details: {
          currentUsage: storageCheck.currentUsage.toString(),
          quota: storageCheck.quota.toString(),
          percentUsed: storageCheck.percentUsed,
        },
      },
      { status: 413 } // 413 Payload Too Large
    );
  }

  // Warn if usage is over 90%
  if (storageCheck.percentUsed > 90) {
    console.warn(
      `Storage warning for organization ${organizationId}: ${storageCheck.percentUsed.toFixed(1)}% used (${formatBytes(storageCheck.currentUsage)} / ${formatBytes(storageCheck.quota)})`
    );
  }

  return null;
}

/**
 * Get storage usage information for display
 */
export async function getStorageInfo(organizationId: string) {
  const storageCheck = await checkStorageLimit(organizationId);

  return {
    currentUsage: storageCheck.currentUsage,
    currentUsageFormatted: formatBytes(storageCheck.currentUsage),
    quota: storageCheck.quota,
    quotaFormatted: formatBytes(storageCheck.quota),
    percentUsed: storageCheck.percentUsed,
    isNearLimit: storageCheck.percentUsed > 80,
    isAtLimit: storageCheck.percentUsed >= 100,
  };
}
