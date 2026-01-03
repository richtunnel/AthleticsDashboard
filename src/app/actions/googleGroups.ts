"use server";

import { getServerSession } from "next-auth";

import { prisma } from "@/lib/database/prisma";
import { googleGroupsService } from "@/lib/services/google-groups.service";
import { authOptions } from "@/lib/utils/authOptions";

export type ImportGoogleEmailGroupsResult = {
  success: boolean;
  message?: string;
  error?: string;
  requiresAuth?: boolean;
  authUrl?: string;
};

const DEFAULT_RETURN_TO = "/dashboard/email-groups";

const getGoogleErrorMessage = (error: unknown): string | null => {
  if (!error || typeof error !== "object") {
    return null;
  }

  const anyError = error as any;

  return (
    anyError?.response?.data?.error?.message ??
    anyError?.response?.data?.error_description ??
    anyError?.message ??
    null
  );
};

const isInsufficientScopesError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const anyError = error as any;
  const status = anyError?.response?.status ?? anyError?.code;
  const message = getGoogleErrorMessage(error)?.toLowerCase() ?? "";

  if (status !== 403 && status !== 401) {
    return false;
  }

  return (
    message.includes("insufficient") ||
    message.includes("permission") ||
    message.includes("scope") ||
    message.includes("not have permission")
  );
};

const buildReconnectUrl = (returnTo: string) => {
  return `/api/auth/calendar-connect?returnTo=${encodeURIComponent(returnTo)}`;
};

export async function importGoogleEmailGroups(options: { returnTo?: string } = {}): Promise<ImportGoogleEmailGroupsResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const returnTo = options.returnTo || DEFAULT_RETURN_TO;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        organizationId: true,
        googleCalendarRefreshToken: true,
      },
    });

    if (!user?.organizationId) {
      return { success: false, error: "Organization not found for user" };
    }

    const account = await prisma.account.findFirst({
      where: {
        userId: user.id,
        provider: "google",
      },
      select: {
        refresh_token: true,
      },
    });

    const refreshToken = user.googleCalendarRefreshToken || account?.refresh_token;

    if (!refreshToken) {
      return {
        success: false,
        requiresAuth: true,
        authUrl: buildReconnectUrl(returnTo),
        error: "Google is not connected. Connect Google Calendar to import Gmail contact groups.",
      };
    }

    const contactGroups = await googleGroupsService.fetchContactGroups(refreshToken);

    if (contactGroups.length === 0) {
      return { success: true, message: "No Google contact groups found." };
    }

    let processedGroups = 0;

    await prisma.$transaction(async (tx) => {
      for (const group of contactGroups) {
        const dbGroup = await tx.emailGroup.upsert({
          where: {
            organizationId_name: {
              organizationId: user.organizationId,
              name: group.name,
            },
          },
          update: {
            name: group.name,
          },
          create: {
            name: group.name,
            userId: user.id,
            organizationId: user.organizationId,
          },
        });

        processedGroups += 1;

        await tx.emailAddress.deleteMany({
          where: { groupId: dbGroup.id },
        });

        const memberEmails = Array.from(new Set(group.memberEmails.map((email) => email.trim().toLowerCase()).filter(Boolean)));

        if (memberEmails.length === 0) {
          continue;
        }

        await tx.emailAddress.createMany({
          data: memberEmails.map((email) => ({
            email,
            groupId: dbGroup.id,
          })),
          skipDuplicates: true,
        });
      }
    });

    return {
      success: true,
      message: `Successfully imported ${processedGroups} groups from Google Contacts.`,
    };
  } catch (error) {
    console.error("Error importing Google email groups:", error);

    if (isInsufficientScopesError(error)) {
      return {
        success: false,
        requiresAuth: true,
        authUrl: buildReconnectUrl(returnTo),
        error: "Your Google connection needs additional permissions to import Gmail contact groups. Please reconnect.",
      };
    }

    return {
      success: false,
      error: getGoogleErrorMessage(error) || (error instanceof Error ? error.message : "An unknown error occurred during import."),
    };
  }
}
