import { google } from "googleapis";

export async function getUserContactGroups(accessToken: string) {
  const people = google.people({ version: "v1" });

  const response = await people.contactGroups.list({
    access_token: accessToken,
    pageSize: 100,
  });

  return response.data.contactGroups; // User's Gmail labels/groups
}

export async function getContactGroupMembers(accessToken: string, groupResourceName: string) {
  const people = google.people({ version: "v1" });

  const group = await people.contactGroups.get({
    resourceName: groupResourceName,
    access_token: accessToken,
    maxMembers: 1000,
  });

  // Extract emails from memberResourceNames
  const memberEmails = await Promise.all(
    (group.data.memberResourceNames || []).map(async (resourceName) => {
      const person = await people.people.get({
        resourceName,
        personFields: "emailAddresses",
        access_token: accessToken,
      });
      return person.data.emailAddresses?.[0]?.value;
    })
  );

  return memberEmails.filter(Boolean);
}
