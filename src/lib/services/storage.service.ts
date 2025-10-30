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
  let total = 0n;

  const games = await prisma.game.findMany({
    where: {
      homeTeam: {
        organizationId,
      },
    },
    select: {
      id: true,
      notes: true,
      customFields: true,
      customData: true,
      time: true,
      googleCalendarEventId: true,
      googleCalendarHtmlLink: true,
    },
  });

  for (const game of games) {
    total += BigInt(stringSize(game.id));
    total += BigInt(stringSize(game.notes));
    total += BigInt(stringSize(game.time));
    total += BigInt(stringSize(game.googleCalendarEventId));
    total += BigInt(stringSize(game.googleCalendarHtmlLink));
    total += BigInt(jsonSize(game.customFields));
    total += BigInt(jsonSize(game.customData));
    total += 100n;
  }

  const teams = await prisma.team.findMany({
    where: { organizationId },
    select: { id: true, name: true, level: true, gender: true },
  });

  for (const team of teams) {
    total += BigInt(stringSize(team.id));
    total += BigInt(stringSize(team.name));
    total += BigInt(stringSize(team.level));
    total += BigInt(stringSize(team.gender));
    total += 50n;
  }

  const venues = await prisma.venue.findMany({
    where: { organizationId },
    select: { id: true, name: true, address: true, city: true, state: true, zipCode: true, notes: true },
  });

  for (const venue of venues) {
    total += BigInt(stringSize(venue.id));
    total += BigInt(stringSize(venue.name));
    total += BigInt(stringSize(venue.address));
    total += BigInt(stringSize(venue.city));
    total += BigInt(stringSize(venue.state));
    total += BigInt(stringSize(venue.zipCode));
    total += BigInt(stringSize(venue.notes));
    total += 50n;
  }

  const opponents = await prisma.opponent.findMany({
    where: { organizationId },
    select: { id: true, name: true, mascot: true, colors: true, contact: true, phone: true, email: true, notes: true },
  });

  for (const opponent of opponents) {
    total += BigInt(stringSize(opponent.id));
    total += BigInt(stringSize(opponent.name));
    total += BigInt(stringSize(opponent.mascot));
    total += BigInt(stringSize(opponent.colors));
    total += BigInt(stringSize(opponent.contact));
    total += BigInt(stringSize(opponent.phone));
    total += BigInt(stringSize(opponent.email));
    total += BigInt(stringSize(opponent.notes));
    total += 50n;
  }

  const emailLogs = await prisma.emailLog.findMany({
    where: {
      game: {
        homeTeam: {
          organizationId,
        },
      },
    },
    select: { id: true, to: true, cc: true, subject: true, body: true, error: true },
  });

  for (const log of emailLogs) {
    total += BigInt(stringSize(log.id));
    total += BigInt(stringSize(log.to.join(",")));
    total += BigInt(stringSize(log.cc.join(",")));
    total += BigInt(stringSize(log.subject));
    total += BigInt(stringSize(log.body));
    total += BigInt(stringSize(log.error));
    total += 50n;
  }

  const emailGroups = await prisma.emailGroup.findMany({
    where: { organizationId },
    include: { emails: true },
  });

  for (const group of emailGroups) {
    total += BigInt(stringSize(group.id));
    total += BigInt(stringSize(group.name));
    for (const email of group.emails) {
      total += BigInt(stringSize(email.id));
      total += BigInt(stringSize(email.email));
    }
    total += 50n;
  }

  const emailCampaigns = await prisma.emailCampaign.findMany({
    where: {
      user: {
        organizationId,
      },
    },
    select: { id: true, name: true, subject: true, body: true },
  });

  for (const campaign of emailCampaigns) {
    total += BigInt(stringSize(campaign.id));
    total += BigInt(stringSize(campaign.name));
    total += BigInt(stringSize(campaign.subject));
    total += BigInt(stringSize(campaign.body));
    total += 50n;
  }

  const customColumns = await prisma.customColumn.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });

  for (const column of customColumns) {
    total += BigInt(stringSize(column.id));
    total += BigInt(stringSize(column.name));
    total += 50n;
  }

  const travelRecommendations = await prisma.travelRecommendation.findMany({
    where: {
      game: {
        homeTeam: {
          organizationId,
        },
      },
    },
    select: { id: true, trafficCondition: true, weatherCondition: true },
  });

  for (const recommendation of travelRecommendations) {
    total += BigInt(stringSize(recommendation.id));
    total += BigInt(stringSize(recommendation.trafficCondition));
    total += BigInt(stringSize(recommendation.weatherCondition));
    total += 100n;
  }

  return total;
}

export async function updateOrganizationStorageUsage(organizationId: string): Promise<bigint> {
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
  const percentUsed = quota > 0n ? (Number(currentUsage) / Number(quota)) * 100 : 0;

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
