"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import { InviteCollaboratorForm } from "./InviteCollaboratorForm";
import { CollaboratorsList } from "./CollaboratorsList";

interface CollaborationMember {
  id: string;
  email: string;
  role: "VIEWER" | "MEMBER";
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  invitedAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  revokeReason: string | null;
  chatAccess?: "PENDING" | "APPROVED" | "REVOKED" | null;
  chatAccessRequestedAt?: string | null;
}

interface CollaboratorsSectionProps {
  readOnly?: boolean;
}

export function CollaboratorsSection({ readOnly = false }: CollaboratorsSectionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<CollaborationMember[]>([]);
  const [usedSlots, setUsedSlots] = useState(0);
  const [availableSlots, setAvailableSlots] = useState(0);
  const [collaboratorLimit, setCollaboratorLimit] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<{ open: boolean; memberId: string | null }>({
    open: false,
    memberId: null,
  });

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/collaboration/members");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch collaborators");
      }

      setMembers(data.members || []);
      setUsedSlots(data.usedSlots || 0);
      setAvailableSlots(data.availableSlots || 0);
      setCollaboratorLimit(data.collaboratorLimit || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleRevoke = async (memberId: string) => {
    setRevokeConfirm({ open: true, memberId });
  };

  const confirmRevoke = async () => {
    if (!revokeConfirm.memberId) return;

    try {
      const response = await fetch(`/api/collaboration/members/${revokeConfirm.memberId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to revoke access");
      }

      // Refresh the list
      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke access");
    } finally {
      setRevokeConfirm({ open: false, memberId: null });
    }
  };

  const handleSuccess = () => {
    fetchMembers();
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const selectedMember = members.find((m) => m.id === revokeConfirm.memberId);
  const isPending = selectedMember?.status === "PENDING" || selectedMember?.status === "EXPIRED";

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <InviteCollaboratorForm
            usedSlots={usedSlots}
            availableSlots={availableSlots}
            collaboratorLimit={collaboratorLimit}
            onSuccess={handleSuccess}
          />
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <CollaboratorsList
            members={members}
            onRevoke={handleRevoke}
            onRefresh={fetchMembers}
          />
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <Dialog
        open={revokeConfirm.open}
        onClose={() => setRevokeConfirm({ open: false, memberId: null })}
      >
        <DialogTitle>
          {isPending ? "Cancel Invitation?" : "Revoke Collaborator Access?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isPending
              ? "Are you sure you want to cancel this invitation? The recipient will no longer be able to use the invitation link."
              : "Are you sure you want to revoke this collaborator's access? They will immediately lose access to your dashboard. They can be re-invited at any time."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeConfirm({ open: false, memberId: null })}>
            Cancel
          </Button>
          <Button onClick={confirmRevoke} color="error" variant="contained">
            {isPending ? "Cancel Invitation" : "Revoke Access"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}