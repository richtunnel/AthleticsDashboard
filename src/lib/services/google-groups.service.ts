import { google } from "googleapis";
import type { people_v1 } from "googleapis";

import { getGoogleAuthClient } from "@/lib/google/auth";

export interface GoogleContactGroup {
  id: string;
  name: string;
  memberEmails: string[];
}

class GoogleGroupsService {
  async fetchContactGroups(refreshToken: string): Promise<GoogleContactGroup[]> {
    const authClient = await getGoogleAuthClient(refreshToken);
    const people = google.people({ version: "v1", auth: authClient });

    const groups: GoogleContactGroup[] = [];
    let pageToken: string | undefined;

    do {
      const response = await people.contactGroups.list({
        pageSize: 200,
        pageToken,
        groupFields: "name,groupType,memberCount",
      });

      const contactGroups = response.data.contactGroups ?? [];

      for (const group of contactGroups) {
        if (!group.resourceName || !group.name) {
          continue;
        }

        if (group.groupType !== "USER_CONTACT_GROUP") {
          continue;
        }

        if (group.memberCount != null && group.memberCount <= 0) {
          continue;
        }

        const groupDetail = await people.contactGroups.get({
          resourceName: group.resourceName,
          maxMembers: 1000,
        });

        const memberResourceNames = groupDetail.data.memberResourceNames ?? [];
        const memberEmails = await this.resolveMemberEmails(people, memberResourceNames);

        groups.push({
          id: group.resourceName,
          name: group.name,
          memberEmails,
        });
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return groups;
  }

  private async resolveMemberEmails(peopleApi: people_v1.People, resourceNames: string[]): Promise<string[]> {
    if (resourceNames.length === 0) {
      return [];
    }

    const emails = new Set<string>();
    const contactResourceNames = resourceNames.filter((name) => !name.startsWith("contactGroups/"));

    const chunkSize = 100;

    for (let index = 0; index < contactResourceNames.length; index += chunkSize) {
      const chunk = contactResourceNames.slice(index, index + chunkSize);

      const batch = await peopleApi.people.getBatchGet({
        resourceNames: chunk,
        personFields: "emailAddresses",
      });

      const responses = batch.data.responses ?? [];

      for (const response of responses) {
        const emailAddresses = response.person?.emailAddresses ?? [];

        for (const email of emailAddresses) {
          if (email?.value) {
            emails.add(email.value);
          }
        }
      }
    }

    return Array.from(emails);
  }
}

export const googleGroupsService = new GoogleGroupsService();
