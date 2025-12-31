import { prisma } from "@/lib/database/prisma";

const ONE_GIGABYTE = 1024 * 1024 * 1024;
const TEN_GIGABYTES = ONE_GIGABYTE * 10;

export const STORAGE_LIMITS = {
  free: ONE_GIGABYTE,
  free_trial_plan: ONE_GIGABYTE,
  standard_monthly: TEN_GIGABYTES,
  standard_yearly: TEN_GIGABYTES,
  directors_monthly: TEN_GIGABYTES,
  directors_annual: TEN_GIGABYTES,
  business_monthly: TEN_GIGABYTES,
  business_yearly: TEN_GIGABYTES,
} as const;

const DEFAULT_LIMIT = STORAGE_LIMITS.free;

function resolvePlanKey(plan: string | null | undefined): keyof typeof STORAGE_LIMITS {
  if (!plan) {
    return "free";
  }

  if ((plan as keyof typeof STORAGE_LIMITS) in STORAGE_LIMITS) {
    return plan as keyof typeof STORAGE_LIMITS;
  }

  return "free";
}

function stringSize(value: string | null | undefined): number {
  return value ? Buffer.byteLength(value, "utf8") : 0;
}

function jsonSize(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch (error) {
    console.warn("Failed to estimate JSON size", error);
    return 0;
  }
}

export async function calculateOrganizationStorage(organizationId: string): Promise<bigint> {
  let total = BigInt(0);

  // Use aggregate or raw queries for better performance and less memory usage
  // Game storage
  const gamesCount = await prisma.game.count({
    where: {
      homeTeam: { organizationId },
    },
  });
  // Average game row size estimate (including notes and JSON)
  total += BigInt(gamesCount) * BigInt(500);

  // Teams
  const teamsCount = await prisma.team.count({
    where: { organizationId },
  });
  total += BigInt(teamsCount) * BigInt(200);

  // Venues
  const venuesCount = await prisma.venue.count({
    where: { organizationId },
  });
  total += BigInt(venuesCount) * BigInt(300);

  // Opponents
  const opponentsCount = await prisma.opponent.count({
    where: { organizationId },
  });
  total += BigInt(opponentsCount) * BigInt(300);

  // Email logs - these can be large, so we estimate more
  const emailLogsCount = await prisma.emailLog.count({
    where: {
      OR: [
        { game: { homeTeam: { organizationId } } },
        { sentBy: { organizationId } }
      ]
    },
  });
  total += BigInt(emailLogsCount) * BigInt(2000); // 2KB per email average

  // Email groups and addresses
  const emailGroupsCount = await prisma.emailGroup.count({
    where: { organizationId },
  });
  total += BigInt(emailGroupsCount) * BigInt(200);

  const emailAddressesCount = await prisma.emailAddress.count({
    where: { group: { organizationId } },
  });
  total += BigInt(emailAddressesCount) * BigInt(100);

  // Email campaigns
  const campaignsCount = await prisma.emailCampaign.count({
    where: { user: { organizationId } },
  });
  total += BigInt(campaignsCount) * BigInt(2000);

  // Custom columns
  const customColumnsCount = await prisma.customColumn.count({
    where: { organizationId },
  });
  total += BigInt(customColumnsCount) * BigInt(100);

  // Travel recommendations
  const travelRecsCount = await prisma.travelRecommendation.count({
    where: { game: { homeTeam: { organizationId } } },
  });
  total += BigInt(travelRecsCount) * BigInt(200);

  return total;
}

export async function updateOrganizationStorageUsage(organizationId: string): Promise<bigint> {
  // Add throttling to avoid too many calculations
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { lastStorageCalculation: true, storageUsageBytes: true },
  });

  if (org?.lastStorageCalculation) {
    const lastCalc = new Date(org.lastStorageCalculation).getTime();
    const now = Date.now();
    if (now - lastCalc < 60 * 1000) {
      // Don't recalculate more than once per minute
      return org.storageUsageBytes;
    }
  }

  const usage = await calculateOrganizationStorage(organizationId);

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      storageUsageBytes: usage,
      lastStorageCalculation: new Date(),
    },
  });

  return usage;
}

export async function getOrganizationStorageQuota(organizationId: string): Promise<bigint> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { storageQuotaBytes: true },
  });

  return organization?.storageQuotaBytes ?? BigInt(DEFAULT_LIMIT);
}

export async function checkStorageLimit(
  organizationId: string,
  estimatedAdditionalBytes: number = 0
): Promise<{
  hasSpace: boolean;
  currentUsage: bigint;
  quota: bigint;
  percentUsed: number;
}> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      storageQuotaBytes: true,
    },
  });

  if (!organization) {
    throw new Error("Organization not found");
  }

  const currentUsage = await updateOrganizationStorageUsage(organizationId);
  const quota = organization.storageQuotaBytes;
  const projectedUsage = currentUsage + BigInt(estimatedAdditionalBytes);
  const percentUsed = quota > BigInt(0) ? (Number(currentUsage) / Number(quota)) * 100 : 0;

  return {
    hasSpace: projectedUsage <= quota,
    currentUsage,
    quota,
    percentUsed,
  };
}

export function estimateDataSize(payload: unknown): number {
  if (!payload || typeof payload !== "object") {
    return 0;
  }

  let total = 0;

  const stack: unknown[] = [payload];

  while (stack.length) {
    const value = stack.pop();

    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "string") {
      total += stringSize(value);
      continue;
    }

    if (typeof value === "number") {
      total += 8;
      continue;
    }

    if (typeof value === "boolean") {
      total += 1;
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        stack.push(item);
      }
      continue;
    }

    if (typeof value === "object") {
      for (const entry of Object.entries(value)) {
        stack.push(entry[0]);
        stack.push(entry[1]);
      }
    }
  }

  return total;
}

export async function isUserOnFreePlan(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const planKey = resolvePlanKey(user?.plan ?? null);
  return planKey === "free" || planKey === "free_trial_plan";
}

export async function updateStorageQuotaForPlanChange(organizationId: string, plan: string): Promise<void> {
  const planKey = resolvePlanKey(plan);
  const quota = STORAGE_LIMITS[planKey] ?? DEFAULT_LIMIT;

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      storageQuotaBytes: BigInt(quota),
    },
  });
}

export function formatBytes(bytes: bigint | number): string {
  const value = typeof bytes === "bigint" ? Number(bytes) : bytes;

  if (value <= 0) {
    return "0 Bytes";
  }

  const units = ["Bytes", "KB", "MB", "GB", "TB"] as const;
  const index = Math.floor(Math.log(value) / Math.log(1024));
  const formatted = value / Math.pow(1024, index);

  return `${Math.round(formatted * 100) / 100} ${units[index]}`;
}
