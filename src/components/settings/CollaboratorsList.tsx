"use client";

import { useState } from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Button,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import {
  Person,
  CheckCircle,
  Schedule,
  PersonOff,
  Refresh,
  ChatBubbleOutline,
  Lock,
  LockOpen,
} from "@mui/icons-material";
import { ROLE_DISPLAY_NAMES, STATUS_DISPLAY_NAMES } from "@/types/collaboration";
import { CollaborativeRole, CollaborativeStatus, CollaboratorChatAccess } from "@prisma/client";

interface Collaborator {
  id: string;
  email: string;
  role: CollaborativeRole;
  status: CollaborativeStatus;
  invitedAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  revokeReason: string | null;
  chatAccess?: CollaboratorChatAccess | null;
  chatAccessRequestedAt?: Date | string | null;
}

interface CollaboratorsListProps {
  members: Collaborator[];
  isLoading?: boolean;
  onRevoke?: (collaboratorId: string) => Promise<void>;
  onChatAccessChange?: (collaboratorId: string, action: "APPROVE" | "REVOKE") => Promise<void>;
  onRefresh?: () => void;
}

export function CollaboratorsList({
  members,
  isLoading = false,
  onRevoke,
  onChatAccessChange,
  onRefresh
}: CollaboratorsListProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [chatAccessProcessingId, setChatAccessProcessingId] = useState<string | null>(null);

  const handleRevoke = async (collaboratorId: string) => {
    if (!onRevoke) return;

    setRevokingId(collaboratorId);
    try {
      await onRevoke(collaboratorId);
    } finally {
      setRevokingId(null);
    }
  };

  const handleChatAccess = async (collaboratorId: string, action: "APPROVE" | "REVOKE") => {
    if (!onChatAccessChange) return;
    setChatAccessProcessingId(collaboratorId);
    try {
      await onChatAccessChange(collaboratorId, action);
    } finally {
      setChatAccessProcessingId(null);
    }
  };

  const getChatAccessChip = (member: Collaborator) => {
    if (member.status !== "ACCEPTED") return null;
    if (!member.chatAccess) {
      // No request yet
      return <Chip label="No Access" size="small" variant="outlined" color="default" icon={<Lock fontSize="inherit" />} />;
    }
    if (member.chatAccess === "PENDING") {
      return (
        <Chip
          label="Requested"
          size="small"
          color="warning"
          icon={<ChatBubbleOutline fontSize="inherit" />}
        />
      );
    }
    if (member.chatAccess === "APPROVED") {
      return <Chip label="Approved" size="small" color="success" icon={<LockOpen fontSize="inherit" />} />;
    }
    if (member.chatAccess === "REVOKED") {
      return <Chip label="Revoked" size="small" color="error" icon={<Lock fontSize="inherit" />} />;
    }
    return null;
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: CollaborativeStatus) => {
    switch (status) {
      case "ACCEPTED":
        return <CheckCircle color="success" fontSize="small" />;
      case "PENDING":
        return <Schedule color="warning" fontSize="small" />;
      case "REVOKED":
      case "EXPIRED":
        return <PersonOff color="error" fontSize="small" />;
      default:
        return <Person color="action" fontSize="small" />;
    }
  };

  const getStatusColor = (status: CollaborativeStatus) => {
    switch (status) {
      case "ACCEPTED":
        return "success";
      case "PENDING":
        return "warning";
      case "REVOKED":
      case "EXPIRED":
        return "error";
      default:
        return "default";
    }
  };

  if (members.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <Person sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No collaborators yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Invite team members to collaborate on your dashboard.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6">
          Active Collaborators ({members.length})
        </Typography>
        {onRefresh && (
          <Tooltip title="Refresh">
            <IconButton onClick={onRefresh} disabled={isLoading}>
              {isLoading ? <CircularProgress size={20} /> : <Refresh />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Chat Access</TableCell>
              <TableCell>Invited</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {member.email}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={ROLE_DISPLAY_NAMES[member.role]}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {getStatusIcon(member.status)}
                    <Chip
                      label={STATUS_DISPLAY_NAMES[member.status]}
                      size="small"
                      color={getStatusColor(member.status) as any}
                    />
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    {getChatAccessChip(member)}
                    {member.status === "ACCEPTED" && onChatAccessChange && (
                      <>
                        {member.chatAccess !== "APPROVED" && (
                          <Button
                            size="small"
                            color="success"
                            variant="outlined"
                            onClick={() => handleChatAccess(member.id, "APPROVE")}
                            disabled={chatAccessProcessingId === member.id}
                            sx={{ minWidth: 80 }}
                          >
                            {chatAccessProcessingId === member.id ? (
                              <CircularProgress size={14} />
                            ) : (
                              "Approve"
                            )}
                          </Button>
                        )}
                        {member.chatAccess === "APPROVED" && (
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() => handleChatAccess(member.id, "REVOKE")}
                            disabled={chatAccessProcessingId === member.id}
                            sx={{ minWidth: 80 }}
                          >
                            {chatAccessProcessingId === member.id ? (
                              <CircularProgress size={14} />
                            ) : (
                              "Revoke"
                            )}
                          </Button>
                        )}
                      </>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(member.invitedAt)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {["ACCEPTED", "PENDING", "EXPIRED"].includes(member.status) && onRevoke && (
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={() => handleRevoke(member.id)}
                      disabled={revokingId === member.id}
                      startIcon={revokingId === member.id ? <CircularProgress size={16} /> : <PersonOff />}
                    >
                      Revoke
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {members.filter(m => m.status === "PENDING").length > 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Pending invitations:</strong> These people have been invited but haven't accepted yet. 
            Invitations expire after 24 hours.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}