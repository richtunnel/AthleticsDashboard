"use client";

import { useQuery } from "@tanstack/react-query";
import { Box, Typography, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Avatar, IconButton, Tooltip, CircularProgress, Alert } from "@mui/material";
import { CalendarMonth, Email, Sync, Person } from "@mui/icons-material";

interface ConnectedParent {
  id: string;
  parentUserId: string;
  parentUserName: string | null;
  parentEmail: string;
  schoolName: string;
  sportName: string;
  sportLevel: string;
  calendarSynced: boolean;
  lastSyncedAt: string | null;
  membershipStatus: string;
  createdAt: string;
}

async function fetchConnectedParents(): Promise<{ parents: ConnectedParent[] }> {
  const res = await fetch("/api/connected-parents");
  if (!res.ok) throw new Error("Failed to fetch connected parents");
  return res.json();
}

export function ConnectedParentsMenu() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["connectedParents"],
    queryFn: fetchConnectedParents,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
      case "TRIALING":
        return "success";
      case "PAST_DUE":
        return "warning";
      case "CANCELED":
      case "UNPAID":
        return "error";
      default:
        return "default";
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load connected parents</Alert>;
  }

  const parents = data?.parents || [];

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Person color="primary" />
          <Typography variant="h6">Manage parent calendar connections</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A log of each parent that has an active membership and has calendars synced with their dashboard.
        </Typography>

        {parents.length === 0 ? (
          <Alert severity="info">No parents have connected to your school yet. Share the parent portal link to get started!</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Parent</TableCell>
                  <TableCell>Sport</TableCell>
                  <TableCell>School</TableCell>
                  <TableCell>Calendar</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parents.map((parent) => (
                  <TableRow key={parent.id}>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: 14 }}>{parent.parentUserName?.charAt(0) || parent.parentEmail.charAt(0)}</Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {parent.parentUserName || "Unknown"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {parent.parentEmail}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{parent.sportName}</Typography>
                      <Chip label={parent.sportLevel} size="small" variant="outlined" sx={{ height: 18, fontSize: "0.65rem" }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{parent.schoolName}</Typography>
                    </TableCell>
                    <TableCell>
                      {parent.calendarSynced ? (
                        <Tooltip title={`Last synced: ${parent.lastSyncedAt ? new Date(parent.lastSyncedAt).toLocaleString() : "Unknown"}`}>
                          <Chip icon={<Sync sx={{ fontSize: 14 }} />} label="Synced" size="small" color="success" variant="outlined" />
                        </Tooltip>
                      ) : (
                        <Chip label="Not Synced" size="small" color="default" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={parent.membershipStatus} size="small" color={getStatusColor(parent.membershipStatus) as any} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
