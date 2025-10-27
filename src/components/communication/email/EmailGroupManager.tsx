"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AlertColor } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { LoadingButton } from "@/components/utils/LoadingButton";
import { EmailGroupCard } from "./EmailGroupCard";
import { ImportGroupsButton } from "./ImportGroupButtonG";
import type { EmailGroup } from "./types";
import {
  addEmailsToGroup,
  createEmailGroup,
  deleteEmailGroup,
  fetchEmailGroups,
  removeEmailFromGroup,
  updateEmailGroupName,
} from "@/lib/api/emailGroups";

type SnackbarState = {
  open: boolean;
  message: string;
  severity: AlertColor;
};

const DEFAULT_SNACKBAR: SnackbarState = {
  open: false,
  message: "",
  severity: "success",
};

export function EmailGroupManager() {
  const queryClient = useQueryClient();
  const [newGroupName, setNewGroupName] = useState("");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [addingGroupId, setAddingGroupId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>(DEFAULT_SNACKBAR);

  const showMessage = (message: string, severity: AlertColor = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const hideMessage = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const {
    data: groups = [],
    isLoading,
    isError,
    error,
  } = useQuery<EmailGroup[], Error>({
    queryKey: ["email-groups"],
    queryFn: fetchEmailGroups,
  });

  useEffect(() => {
    if (!isLoading && groups.length > 0 && !activeGroupId) {
      setActiveGroupId(groups[0].id);
    }
  }, [groups, isLoading, activeGroupId]);

  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [groups]);

  const updateCacheWithGroup = (updatedGroup: EmailGroup) => {
    queryClient.setQueryData<EmailGroup[]>(["email-groups"], (previous = []) => {
      const filtered = previous.filter((group) => group.id !== updatedGroup.id);
      return [updatedGroup, ...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
  };

  const removeGroupFromCache = (groupId: string) => {
    queryClient.setQueryData<EmailGroup[]>(["email-groups"], (previous = []) => previous.filter((group) => group.id !== groupId));
  };

  const createGroupMutation = useMutation({
    mutationFn: (name: string) => createEmailGroup({ name }),
    onSuccess: (group) => {
      updateCacheWithGroup(group);
      setNewGroupName("");
      setActiveGroupId(group.id);
      setAddingGroupId(group.id);
      showMessage(`Group "${group.name}" created!`);
      queryClient.invalidateQueries({ queryKey: ["email-groups"] });
    },
    onError: (mutationError: Error) => {
      showMessage(mutationError.message, "error");
    },
  });

  const renameGroupMutation = useMutation({
    mutationFn: (payload: { groupId: string; name: string }) => updateEmailGroupName(payload),
    onSuccess: (group) => {
      updateCacheWithGroup(group);
      queryClient.invalidateQueries({ queryKey: ["email-groups"] });
    },
    onError: (mutationError: Error) => {
      showMessage(mutationError.message, "error");
    },
  });

  const addEmailsMutation = useMutation({
    mutationFn: (payload: { groupId: string; emails: string[] }) => addEmailsToGroup(payload),
    onSuccess: (group) => {
      updateCacheWithGroup(group);
      queryClient.invalidateQueries({ queryKey: ["email-groups"] });
    },
    onError: () => {
      // Card handles error display, so no message here to avoid duplicates
    },
  });

  const removeEmailMutation = useMutation({
    mutationFn: (payload: { groupId: string; emailId: string }) => removeEmailFromGroup(payload),
    onSuccess: (group) => {
      updateCacheWithGroup(group);
      queryClient.invalidateQueries({ queryKey: ["email-groups"] });
    },
    onError: () => {
      // Card handles error display
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) => deleteEmailGroup(groupId),
    onSuccess: (_data, groupId) => {
      removeGroupFromCache(groupId);
      queryClient.invalidateQueries({ queryKey: ["email-groups"] });

      if (activeGroupId === groupId) {
        const nextGroups = queryClient.getQueryData<EmailGroup[]>(["email-groups"]);
        setActiveGroupId(nextGroups && nextGroups.length > 0 ? nextGroups[0].id : null);
      }

      if (addingGroupId === groupId) {
        setAddingGroupId(null);
      }
    },
    onError: (mutationError: Error) => {
      showMessage(mutationError.message, "error");
    },
  });

  const handleCreateGroup = () => {
    const trimmed = newGroupName.trim();

    if (!trimmed) {
      showMessage("Enter a name for your email group", "error");
      return;
    }

    createGroupMutation.mutate(trimmed);
  };

  return (
    <Box>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Email Campaign Manager
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Create email groups, add recipients, and keep your bulk email campaigns organized.
          </Typography>
        </Box>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", md: "center" }}
          sx={{ flexWrap: "wrap" }}
        >
          <TextField
            label="Name your group"
            placeholder="e.g. Varsity Parents"
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            fullWidth
            sx={{ flex: { md: 1 } }}
          />
          <LoadingButton
            startIcon={<AddCircleOutlineIcon />}
            loading={createGroupMutation.isPending}
            onClick={handleCreateGroup}
            loadingText="Creating"
            disabled={!newGroupName.trim()}
            sx={{ width: { xs: "100%", md: "auto" }, maxWidth: { md: 220 } }}
          >
            Create Group
          </LoadingButton>
          <Box sx={{ width: { xs: "100%", md: "auto" } }}>
            <ImportGroupsButton />
          </Box>
        </Stack>

        {isError && (
          <Alert severity="error">{error?.message || "Unable to load email groups."}</Alert>
        )}

        {isLoading ? (
          <Stack spacing={2}>
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} variant="rounded" height={160} />
            ))}
          </Stack>
        ) : sortedGroups.length === 0 ? (
          <Box
            sx={{
              border: "1px dashed",
              borderColor: "divider",
              p: 4,
              borderRadius: 3,
              textAlign: "center",
              backgroundColor: "background.default",
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              No email groups yet
            </Typography>
            <Typography color="text.secondary">
              Create your first group to start sending targeted announcements and updates.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={3}>
            {sortedGroups.map((group) => (
              <EmailGroupCard
                key={group.id}
                group={group}
                isActive={activeGroupId === group.id}
                isAddingEmails={addingGroupId === group.id}
                onToggleAddEmails={() => {
                  setActiveGroupId(group.id);
                  setAddingGroupId((prev) => (prev === group.id ? null : group.id));
                }}
                onSelect={() => setActiveGroupId(group.id)}
                onAddEmails={async (emails) => {
                  await addEmailsMutation.mutateAsync({ groupId: group.id, emails });
                }}
                addEmailsLoading={addEmailsMutation.isPending && addEmailsMutation.variables?.groupId === group.id}
                onRemoveEmail={async (emailId) => {
                  await removeEmailMutation.mutateAsync({ groupId: group.id, emailId });
                }}
                removeEmailLoadingId={
                  removeEmailMutation.isPending && removeEmailMutation.variables?.groupId === group.id
                    ? removeEmailMutation.variables?.emailId ?? null
                    : null
                }
                onRename={async (name) => {
                  await renameGroupMutation.mutateAsync({ groupId: group.id, name });
                }}
                renameLoading={renameGroupMutation.isPending && renameGroupMutation.variables?.groupId === group.id}
                onDelete={async () => {
                  await deleteGroupMutation.mutateAsync(group.id);
                }}
                deleteLoading={deleteGroupMutation.isPending && deleteGroupMutation.variables === group.id}
                onShowMessage={showMessage}
              />
            ))}
          </Stack>
        )}
      </Stack>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={hideMessage}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={hideMessage} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
