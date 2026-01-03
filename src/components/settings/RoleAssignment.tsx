"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Avatar,
  Divider,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { UserRole } from "@/lib/utils/auth";
import {
  sendInvitation,
  getInvitations,
  revokeInvitation,
  getTeamMembers,
  revokeAccess,
} from "@/app/dashboard/settings/invitation-actions";

export default function RoleAssignment() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.MEMBER);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  const loadData = async () => {
    setFetching(true);
    const [invitesRes, membersRes] = await Promise.all([getInvitations(), getTeamMembers()]);
    if (invitesRes.success) setInvitations(invitesRes.invitations || []);
    if (membersRes.success) setMembers(membersRes.members || []);
    setFetching(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await sendInvitation(email, role);
    if (res.success) {
      setMessage({ type: "success", text: "Invitation sent successfully" });
      setEmail("");
      loadData();
    } else {
      setMessage({ type: "error", text: res.error || "Failed to send invitation" });
    }
    setLoading(false);
  };

  const handleRevokeInvitation = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this invitation?")) return;
    const res = await revokeInvitation(id);
    if (res.success) {
      loadData();
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    if (!confirm("Are you sure you want to revoke access for this user? They will no longer be able to access this organization.")) return;
    const res = await revokeAccess(userId);
    if (res.success) {
      loadData();
    } else {
      alert(res.error || "Failed to revoke access");
    }
  };

  if (fetching) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: "1000px" }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        Role Assignment & Collaboration
      </Typography>

      <Card sx={{ mb: 4, boxShadow: "none", border: "1px solid", borderColor: "divider" }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Invite New Member
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Send an invitation email to someone you'd like to collaborate with. 
            Admins have full access, while Members cannot modify settings or disconnect calendars.
          </Typography>

          <form onSubmit={handleInvite}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-start">
              <TextField
                size="small"
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                sx={{ maxWidth: 400 }}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Role</InputLabel>
                <Select
                  value={role}
                  label="Role"
                  onChange={(e) => setRole(e.target.value as UserRole)}
                >
                  <MenuItem value={UserRole.ADMIN}>Admin</MenuItem>
                  <MenuItem value={UserRole.MEMBER}>Member</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                type="submit"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={18} /> : <PersonAddIcon />}
              >
                Send Invite
              </Button>
            </Stack>
          </form>

          {message && (
            <Alert severity={message.type} sx={{ mt: 2 }}>
              {message.text}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Typography variant="h6" gutterBottom>
        Active Team Members
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 4, boxShadow: "none", border: "1px solid", borderColor: "divider" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Avatar src={member.image} sx={{ width: 32, height: 32 }}>
                      {member.name?.charAt(0) || member.email.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {member.name || "Unnamed User"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {member.email}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={member.role} 
                    size="small" 
                    color={member.role === UserRole.ADMIN || member.role === UserRole.ATHLETIC_DIRECTOR ? "primary" : "default"} 
                    variant="outlined" 
                  />
                </TableCell>
                <TableCell>
                  {new Date(member.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell align="right">
                  <IconButton 
                    size="small" 
                    color="error" 
                    onClick={() => handleRevokeAccess(member.id)}
                    title="Revoke Access"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {invitations.length > 0 && (
        <>
          <Typography variant="h6" gutterBottom>
            Pending Invitations
          </Typography>
          <TableContainer component={Paper} sx={{ boxShadow: "none", border: "1px solid", borderColor: "divider" }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invitations.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell>
                      <Chip label={invite.role} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton 
                        size="small" 
                        color="error" 
                        onClick={() => handleRevokeInvitation(invite.id)}
                        title="Revoke Invitation"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
