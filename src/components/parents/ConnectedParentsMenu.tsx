"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar,
  Tooltip,
  CircularProgress,
  Alert,
} from "@mui/material";
import { Sync, Person } from "@mui/icons-material";
import { PendingParentRequests } from "./PendingParentRequests";

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
  mappingInfo?: string | null;
}

interface ScheduleMapping {
  id: string;
  columnName: string;
  columnValue: string;
  parentAthleteLink: {
    athleteName: string;
    parent: { email: string };
  };
}

async function fetchConnectedParents(): Promise<{ parents: ConnectedParent[] }> {
  const res = await fetch("/api/connected-parents");
  if (!res.ok) throw new Error("Failed to fetch connected parents");
  return res.json();
}

async function fetchScheduleMappings(): Promise<{ mappings: ScheduleMapping[] }> {
  const res = await fetch("/api/parent-schedule-mappings");
  if (!res.ok) return { mappings: [] };
  return res.json();
}

export function ConnectedParentsMenu() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["connectedParents"],
    queryFn: fetchConnectedParents,
    staleTime: 5 * 60 * 1000,
  });

  const { data: mappingsData } = useQuery({
    queryKey: ["scheduleMappings"],
    queryFn: fetchScheduleMappings,
    staleTime: 5 * 60 * 1000,
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

  // Build a lookup: parentEmail -> mapping info string
  const mappingByEmail = new Map<string, string>();
  if (mappingsData?.mappings) {
    for (const m of mappingsData.mappings) {
      const email = m.parentAthleteLink.parent.email;
      mappingByEmail.set(email, `${m.columnName} = ${m.columnValue}`);
    }
  }

  const parents = data?.parents || [];

  return (
    <Card>
      <CardContent>
        <PendingParentRequests />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Person color="primary" />
          <Typography variant="h6">
            Parents & Athletes Connect
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A log of each parent that has an active membership and has calendars synced with their dashboard.
        </Typography>

        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : error ? (
          <Typography variant="body2" color="text.secondary">
            Unable to load connected parents right now.
          </Typography>
        ) : parents.length === 0 ? (
          <Alert severity="info">
            No parents have connected to your school yet. Share the parent portal link to get started!
          </Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Parent</TableCell>
                  <TableCell>Sport</TableCell>
                  <TableCell>Schedule Mapping</TableCell>
                  <TableCell>School</TableCell>
                  <TableCell>Calendar</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parents.map((parent) => {
                  const mappingInfo = mappingByEmail.get(parent.parentEmail);
                  return (
                    <TableRow key={parent.id}>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: 14 }}>
                            {parent.parentUserName?.charAt(0) || parent.parentEmail.charAt(0)}
                          </Avatar>
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
                        <Typography variant="body2">
                          {parent.sportName}
                        </Typography>
                        {parent.sportLevel && (
                          <Chip
                            label={parent.sportLevel}
                            size="small"
                            variant="outlined"
                            sx={{ height: 18, fontSize: "0.65rem" }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {mappingInfo ? (
                          <Chip
                            label={mappingInfo}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ maxWidth: 200 }}
                          />
                        ) : (
                          <Chip
                            label="Not mapped"
                            size="small"
                            color="default"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {parent.schoolName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {parent.calendarSynced ? (
                          <Tooltip title={`Last synced: ${parent.lastSyncedAt ? new Date(parent.lastSyncedAt).toLocaleString() : 'Unknown'}`}>
                            <Chip
                              icon={<Sync sx={{ fontSize: 14 }} />}
                              label="Synced"
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          </Tooltip>
                        ) : (
                          <Chip
                            label="Not Synced"
                            size="small"
                            color="default"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={parent.membershipStatus}
                          size="small"
                          color={getStatusColor(parent.membershipStatus) as any}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
