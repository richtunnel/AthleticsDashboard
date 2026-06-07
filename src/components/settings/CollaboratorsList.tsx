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
  Tune,
} from "@mui/icons-material";
import Link from "next/link";
import { ROLE_DISPLAY_NAMES, STATUS_DISPLAY_NAMES } from "@/types/collaboration";
import { CollaborativeRole, CollaborativeStatus } from "@prisma/client";

interface Collaborator {
  id: string;
  email: string;
  role: CollaborativeRole;
  status: CollaborativeStatus;
  invitedAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  revokeReason: string | null;
}

interface CollaboratorsListProps {
  members: Collaborator[];
  isLoading?: boolean;
  onRevoke?: (collaboratorId: string) => Promise<void>;
  onRefresh?: () => void;
}

export function CollaboratorsList({
  members,
  isLoading = false,
  onRevoke,
  onRefresh,
}: CollaboratorsListProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRevoke = async (collaboratorId: string) => {
    if (!onRevoke) return;
    setRevokingId(collaboratorId);
    try {
      await onRevoke(collaboratorId);
    } finally {
      setRevokingId(null);
    }
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
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(member.invitedAt)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
                    {member.status === "ACCEPTED" && (
                      <Tooltip title="Manage which dashboard features this collaborator can access">
                        <Button
                          component={Link}
                          href={`/dashboard/settings/collaborators/${member.id}/permissions`}
                          size="small"
                          variant="outlined"
                          color="primary"
                          startIcon={<Tune fontSize="small" />}
                          sx={{ textTransform: "none" }}
                        >
                          Permissions
                        </Button>
                      </Tooltip>
                    )}
                    {["ACCEPTED", "PENDING", "EXPIRED"].includes(member.status) && onRevoke && (
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={() => handleRevoke(member.id)}
                        disabled={revokingId === member.id}
                        startIcon={revokingId === member.id ? <CircularProgress size={16} /> : <PersonOff />}
                        sx={{ textTransform: "none" }}
                      >
                        Revoke
                      </Button>
                    )}
                  </Box>
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