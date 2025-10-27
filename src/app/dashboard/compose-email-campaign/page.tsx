"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Divider,
  Link as MuiLink,
  List,
  ListItem,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AlertColor } from "@mui/material";
import LaunchIcon from "@mui/icons-material/Launch";
import { LoadingButton } from "@/components/utils/LoadingButton";
import { BulkEmailDropdown } from "@/components/communication/email/BulkEmailDropdown";
import type { EmailGroup } from "@/components/communication/email/types";
import { fetchEmailGroups } from "@/lib/api/emailGroups";

interface SnackbarState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

const DEFAULT_SNACKBAR: SnackbarState = {
  open: false,
  message: "",
  severity: "success",
};

async function sendCampaign(payload: { subject: string; body: string; groupId: string }) {
  const response = await fetch("/api/email-campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, sendNow: true }),
  });

  if (!response.ok) {
    let message = "Failed to send campaign";

    try {
      const data = await response.json();
      if (data?.error) {
        message = data.error;
      }
    } catch (error) {
      // ignore parse errors
    }

    throw new Error(message);
  }

  return response.json();
}

export default function ComposeEmailPage() {
  const { status } = useSession();
  const router = useRouter();
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [snackbar, setSnackbar] = useState<SnackbarState>(DEFAULT_SNACKBAR);

  const {
    data: groups = [],
    isLoading: groupsLoading,
    error: groupsError,
  } = useQuery<EmailGroup[], Error>({ queryKey: ["email-groups"], queryFn: fetchEmailGroups });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const selectedGroup = useMemo(() => groups.find((group) => group.id === selectedGroupId) ?? null, [groups, selectedGroupId]);

  const sendMutation = useMutation({
    mutationFn: sendCampaign,
    onSuccess: () => {
      setSnackbar({ open: true, message: "Campaign sent successfully!", severity: "success" });
      setSubject("");
      setBody("");
    },
    onError: (error: Error) => {
      setSnackbar({ open: true, message: error.message, severity: "error" });
    },
  });

  const showSnackbar = (message: string, severity: AlertColor = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const hideSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleSend = () => {
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();

    if (!selectedGroupId) {
      showSnackbar("Select an email group", "error");
      return;
    }

    if (!trimmedSubject || !trimmedBody) {
      showSnackbar("Subject and message are required", "error");
      return;
    }

    if (selectedGroup && selectedGroup._count.emails === 0) {
      showSnackbar("Selected group has no recipients", "error");
      return;
    }

    sendMutation.mutate({ subject: trimmedSubject, body: trimmedBody, groupId: selectedGroupId });
  };

  if (status === "loading") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", py: 4 }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Compose Email Campaign
          </Typography>
          <Typography color="text.secondary">
            Choose a group, craft your message, and send updates to everyone in just a few clicks.
          </Typography>
        </Box>

        {groupsError && <Alert severity="error">{groupsError.message}</Alert>}

        <Paper elevation={3} sx={{ borderRadius: 3, p: { xs: 3, md: 4 } }}>
          <Stack spacing={3}>
            <BulkEmailDropdown value={selectedGroupId} onChange={setSelectedGroupId} label="Send to Email Group" helperText="Email groups refresh automatically when new ones are created." />

            {selectedGroup && selectedGroup._count.emails === 0 && (
              <Alert severity="warning">This group does not contain any recipients yet. Add emails before sending.</Alert>
            )}

            <TextField label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} required fullWidth />
            <TextField
              label="Message"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              multiline
              minRows={6}
              placeholder="Write your campaign message here"
              required
              fullWidth
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
              <MuiLink
                component="button"
                type="button"
                onClick={() => router.push("/dashboard/email-groups")}
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 600 }}
              >
                Manage email groups
                <LaunchIcon fontSize="small" />
              </MuiLink>

              <LoadingButton
                color="primary"
                onClick={handleSend}
                loading={sendMutation.isPending}
                loadingText="Sending..."
                disabled={groupsLoading || !selectedGroupId || (selectedGroup ? selectedGroup._count.emails === 0 : false)}
              >
                Send Campaign
              </LoadingButton>
            </Stack>
          </Stack>
        </Paper>

        {selectedGroup && (
          <Paper elevation={1} sx={{ borderRadius: 3, p: { xs: 3, md: 4 } }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Recipient Preview
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {selectedGroup._count.emails} recipient{selectedGroup._count.emails === 1 ? "" : "s"} in "{selectedGroup.name}"
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {selectedGroup.emails.length === 0 ? (
              <Typography color="text.secondary">No recipients yet. Add contacts from the email groups page.</Typography>
            ) : (
              <Box>
                <List dense sx={{ maxHeight: 260, overflowY: "auto" }}>
                  {selectedGroup.emails.map((email) => (
                    <ListItem key={email.id}>
                      <ListItemText primary={email.email} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Paper>
        )}
      </Stack>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={hideSnackbar} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert onClose={hideSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
