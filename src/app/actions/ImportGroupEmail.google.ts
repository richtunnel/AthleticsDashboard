// src/app/actions/email.ts (CORRECTED)

import { prisma } from "@/lib/database/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { google } from "googleapis";
import { getGoogleAuthClient } from "@/lib/google/auth"; // Use the client getter

export async function importGoogleEmailGroups() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        organizationId: true,
        googleCalendarRefreshToken: true,
        id: true,
      },
    });

    if (!user?.organizationId || !user.googleCalendarRefreshToken) {
      return { success: false, error: "User or refresh token not found" };
    }

    // --- 1. Get an authenticated client (handles token refresh) ---
    const authClient = await getGoogleAuthClient(user.googleCalendarRefreshToken);

    // --- 2. Initialize People API Client with Auth ---
    const people = google.people({
      version: "v1",
      auth: authClient, // Use the authenticated client
    });

    // --- 3. Fetch Contact Groups (FIX: Removed invalid groupFields) ---
    const groupsResponse = await people.contactGroups.list({
      // Request body is empty here
    });

    const contactGroups = groupsResponse.data.contactGroups || [];
    let importedGroupsCount = 0;

    // --- 4. Process and Save Groups/Emails ---
    for (const group of contactGroups) {
      if (!group.resourceName || !group.name) continue;

      // Upsert the EmailGroup record
      const dbGroup = await prisma.emailGroup.upsert({
        where: { organizationId_name: { organizationId: user.organizationId, name: group.name } }, // Assuming a unique composite index or similar logic
        update: { name: group.name },
        create: {
          name: group.name,
          userId: user.id,
          organizationId: user.organizationId,
        },
      });
      importedGroupsCount++;

      // --- 5. Fetch Members of the Group (CORRECTED LOGIC) ---
      // Get the full group details to see the members' resource names
      const groupDetail = await people.contactGroups.get({
        resourceName: group.resourceName,
        maxMembers: 1000,
      });

      const memberResourceNames = groupDetail.data.memberResourceNames || [];
      const emailAddresses: string[] = [];

      // Batch fetch contact details to get their emails
      // Note: This can be optimized using people.people.getBatch, but this is clearer.
      const personPromises = memberResourceNames.map(async (resourceName) => {
        // If resourceName starts with "contactGroups/", it's a nested group, which we skip for simplicity
        if (resourceName.startsWith("contactGroups/")) return null;

        const person = await people.people.get({
          resourceName,
          personFields: "emailAddresses",
        });
        return person.data.emailAddresses?.[0]?.value;
      });

      const allEmails = await Promise.all(personPromises);
      const uniqueEmails = allEmails.filter((email): email is string => Boolean(email));

      // Save all unique email addresses associated with this group
      if (uniqueEmails.length > 0) {
        await prisma.emailAddress.createMany({
          data: uniqueEmails.map((email) => ({
            email: email,
            groupId: dbGroup.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    return {
      success: true,
      message: `Successfully imported ${importedGroupsCount} groups and their members.`,
    };
  } catch (error) {
    console.error("Error importing Google email groups:", error);
    return {
      success: false,
      error: (error as Error).message || "An unknown error occurred during import.",
    };
  }
}
