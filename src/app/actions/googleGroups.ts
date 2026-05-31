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
  /** Number of contact groups actually written to the DB. 0 when the user has
   *  no Google contact groups (still a "success" outcome, but the UI should
   *  not show the green confirmation). Undefined for auth/error responses. */
  importedGroups?: number;
  /** Total number of unique email addresses pulled in across every Google
   *  contact group. Used by the UI to decide between "imported N contacts"
   *  vs "no contacts found" messaging. */
  importedEmails?: number;
  /** Name of the consolidated EmailGroup the import auto-creates. */
  campaignGroupName?: string;
  /**
   * Discriminator the UI uses to pick the right notification severity:
   *   "imported"    → success with green Alert
   *   "no_groups"   → info, "your Google account has no contact groups"
   *   "no_contacts" → info, "contact groups exist but have no emails"
   *   "needs_auth"  → handled separately (silent — we redirect)
   *   "failed"      → red Alert
   */
  status?: "imported" | "no_groups" | "no_contacts" | "needs_auth" | "failed";
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
    return { success: false, error: "Unauthorized", status: "failed" };
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
      return { success: false, error: "Organization not found for user", status: "failed" };
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
        status: "needs_auth",
      };
    }

    const contactGroups = await googleGroupsService.fetchContactGroups(refreshToken);

    if (contactGroups.length === 0) {
      return {
        success: true,
        message: "We didn't find any contact groups in your Google account.",
        importedGroups: 0,
        importedEmails: 0,
        status: "no_groups",
      };
    }

    // ── Collect every unique email across every group ─────────────────────
    // The user asked for ONE consolidated campaign-group called "Google Contact"
    // containing all imported emails. We still write per-group rows below so
    // the original Google contact-group structure is preserved (useful for
    // sending to "Family" vs "Work" specifically) — but the consolidated
    // group is the headline result.
    const allEmails = new Set<string>();
    for (const group of contactGroups) {
      for (const email of group.memberEmails) {
        const clean = email.trim().toLowerCase();
        if (clean) allEmails.add(clean);
      }
    }

    if (allEmails.size === 0) {
      return {
        success: true,
        message:
          "We found your Google contact groups but they don't contain any email addresses.",
        importedGroups: 0,
        importedEmails: 0,
        status: "no_contacts",
      };
    }

    const CAMPAIGN_GROUP_NAME = "Google Contact";
    let processedGroups = 0;

    await prisma.$transaction(async (tx) => {
      // 1. Preserve per-group structure (Family, Work, etc.) for users who
      //    want to send to a specific subset later.
      for (const group of contactGroups) {
        const dbGroup = await tx.emailGroup.upsert({
          where: {
            organizationId_name: {
              organizationId: user.organizationId,
              name: group.name,
            },
          },
          update: { name: group.name },
          create: {
            name: group.name,
            userId: user.id,
            organizationId: user.organizationId,
          },
        });

        processedGroups += 1;

        await tx.emailAddress.deleteMany({ where: { groupId: dbGroup.id } });

        const memberEmails = Array.from(
          new Set(
            group.memberEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)
          )
        );

        if (memberEmails.length === 0) continue;

        await tx.emailAddress.createMany({
          data: memberEmails.map((email) => ({ email, groupId: dbGroup.id })),
          skipDuplicates: true,
        });
      }

      // 2. Upsert the consolidated "Google Contact" group with EVERY unique
      //    email. This is what the success notification points the user at.
      const consolidated = await tx.emailGroup.upsert({
        where: {
          organizationId_name: {
            organizationId: user.organizationId,
            name: CAMPAIGN_GROUP_NAME,
          },
        },
        update: { name: CAMPAIGN_GROUP_NAME },
        create: {
          name: CAMPAIGN_GROUP_NAME,
          userId: user.id,
          organizationId: user.organizationId,
        },
      });

      await tx.emailAddress.deleteMany({ where: { groupId: consolidated.id } });
      await tx.emailAddress.createMany({
        data: Array.from(allEmails).map((email) => ({
          email,
          groupId: consolidated.id,
        })),
        skipDuplicates: true,
      });
    });

    return {
      success: true,
      message: `Imported ${allEmails.size} contact${allEmails.size === 1 ? "" : "s"} into the "${CAMPAIGN_GROUP_NAME}" group.`,
      importedGroups: processedGroups,
      importedEmails: allEmails.size,
      campaignGroupName: CAMPAIGN_GROUP_NAME,
      status: "imported",
    };
  } catch (error) {
    console.error("Error importing Google email groups:", error);

    if (isInsufficientScopesError(error)) {
      return {
        success: false,
        requiresAuth: true,
        authUrl: buildReconnectUrl(returnTo),
        error: "Your Google connection needs additional permissions to import Gmail contact groups. Please reconnect.",
        status: "needs_auth",
      };
    }

    return {
      success: false,
      error: getGoogleErrorMessage(error) || (error instanceof Error ? error.message : "An unknown error occurred during import."),
      status: "failed",
    };
  }
}
