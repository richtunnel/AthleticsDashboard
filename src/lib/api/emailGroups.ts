import type { EmailGroup } from "@/components/communication/email/types";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Request failed";

    try {
      const data = await response.json();
      if (data?.error) {
        message = data.error;
      }
    } catch (error) {
      // Ignore JSON parse errors and use default message
    }

    throw new Error(message);
  }

  return response.json();
}

export async function fetchEmailGroups(): Promise<EmailGroup[]> {
  const response = await fetch("/api/email-groups", { cache: "no-store" });
  return handleResponse<EmailGroup[]>(response);
}

export async function createEmailGroup(payload: { name: string }): Promise<EmailGroup> {
  const response = await fetch("/api/email-groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handleResponse<EmailGroup>(response);
}

export async function updateEmailGroupName(payload: { groupId: string; name: string }): Promise<EmailGroup> {
  const response = await fetch(`/api/email-groups/${payload.groupId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: payload.name }),
  });

  return handleResponse<EmailGroup>(response);
}

export async function deleteEmailGroup(groupId: string): Promise<void> {
  const response = await fetch(`/api/email-groups/${groupId}`, {
    method: "DELETE",
  });

  await handleResponse(response);
}

export async function addEmailsToGroup(payload: { groupId: string; emails: string[] }): Promise<EmailGroup> {
  const response = await fetch(`/api/email-groups/${payload.groupId}/emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emails: payload.emails }),
  });

  return handleResponse<EmailGroup>(response);
}

export async function removeEmailFromGroup(payload: { groupId: string; emailId: string }): Promise<EmailGroup> {
  const response = await fetch(`/api/email-groups/${payload.groupId}/emails/${payload.emailId}`, {
    method: "DELETE",
  });

  return handleResponse<EmailGroup>(response);
}
