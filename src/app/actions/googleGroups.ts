"use server";

import { getServerSession } from "next-auth";

import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";
import { googleGroupsService } from "@/lib/services/google-groups.service";

export async function importGoogleEmailGroups() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

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

    if (!user.googleCalendarRefreshToken) {
      return { success: false, error: "Google account not connected. Please connect your calendar first." };
    }

    const contactGroups = await googleGroupsService.fetchContactGroups(user.googleCalendarRefreshToken);

    if (contactGroups.length === 0) {
      return { success: true, message: "No Google contact groups found." };
    }

    let processedGroups = 0;

    for (const group of contactGroups) {
      const dbGroup = await prisma.emailGroup.upsert({
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

      await prisma.emailAddress.deleteMany({
        where: { groupId: dbGroup.id },
      });

      if (group.memberEmails.length === 0) {
        continue;
      }

      await prisma.emailAddress.createMany({
        data: group.memberEmails.map((email) => ({
          email,
          groupId: dbGroup.id,
        })),
        skipDuplicates: true,
      });
    }

    return {
      success: true,
      message: `Successfully imported ${processedGroups} groups from Google Contacts.`,
    };
  } catch (error) {
    console.error("Error importing Google email groups:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred during import.",
    };
  }
}
