"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Stack,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  TablePagination,
} from "@mui/material";
import {
  Visibility,
  Refresh,
  CheckCircle,
  Error,
  Schedule,
  Edit,
} from "@mui/icons-material";
import { format } from "date-fns";

interface EmailLog {
  id: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  status: "PENDING" | "SENT" | "FAILED";
  sentAt: string | null;
  error: string | null;
  createdAt: string;
  gameIds: string[];
  groupId: string | null;
  campaignId: string | null;
  recipientCategory: string | null;
  additionalMessage: string | null;
  sentBy: {
    name: string | null;
    email: string;
  } | null;
  game: {
    id: string;
    date: string;
    homeTeam: {
      name: string;
      sport: {
        name: string;
      };
    };
    opponent: {
      name: string;
    } | null;
  } | null;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function EmailLogsPage() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState("all");

  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["email-logs", page + 1, rowsPerPage, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page + 1),
        limit: String(rowsPerPage),
        status: statusFilter,
      });
      const res = await fetch(`/api/email-logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch email logs");
      return res.json();
    },
  });

  const logs: EmailLog[] = response?.data?.logs || [];
  const pagination: PaginationData = response?.data?.pagination || {
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewDetails = (logId: string) => {
    router.push(`/dashboard/email-logs/${logId}`);
  };

  const handleReopenEdit = async (logId: string) => {
    try {
      const res = await fetch(`/api/email-logs/${logId}`);
      if (!res.ok) throw new Error("Failed to load email log");
      
      const data = await res.json();
      const log = data.data.log;
      const games = data.data.games;

      // Store data in sessionStorage and navigate to compose page
      if (games && games.length > 0) {
        sessionStorage.setItem("selectedGames", JSON.stringify(games));
        sessionStorage.setItem("emailDraft", JSON.stringify({
          subject: log.subject,
          additionalMessage: log.additionalMessage || "",
          recipientCategory: log.recipientCategory || "parents",
        }));
        router.push("/dashboard/compose-email");
      } else {
        alert("No games associated with this email to re-send");
      }
    } catch (error) {
      console.error("Failed to reopen email:", error);
      alert("Failed to load email for editing");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SENT":
        return <CheckCircle fontSize="small" color="success" />;
      case "FAILED":
        return <Error fontSize="small" color="error" />;
      case "PENDING":
        return <Schedule fontSize="small" color="warning" />;
      default:
        return null;
    }
  };

  const getStatusChip = (status: string) => {
    const statusConfig: Record<string, { color: "success" | "error" | "warning" | "default", label: string }> = {
      SENT: { color: "success", label: "Sent" },
      FAILED: { color: "error", label: "Failed" },
      PENDING: { color: "warning", label: "Pending" },
    };
    
    const config = statusConfig[status] || { color: "default" as const, label: status };
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return format(new Date(dateString), "MMM d, yyyy h:mm a");
    } catch (error) {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Email Logs
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View and manage your sent emails, including the ability to re-open, edit, and resend
        </Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
          <TextField
            select
            label="Filter by Status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="SENT">Sent</MenuItem>
            <MenuItem value="FAILED">Failed</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
          </TextField>

          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => refetch()}
            size="small"
          >
            Refresh
          </Button>
        </Stack>

        {logs.length === 0 ? (
          <Alert severity="info">No email logs found. Send some emails to see them here!</Alert>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f8fafc" }}>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Subject</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Recipients</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Games</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell>{formatDate(log.sentAt || log.createdAt)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {log.subject}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={log.to.join(", ")}>
                          <Chip label={`${log.to.length} recipient${log.to.length !== 1 ? "s" : ""}`} size="small" />
                        </Tooltip>
                      </TableCell>
                      <TableCell>{getStatusChip(log.status)}</TableCell>
                      <TableCell>
                        {log.gameIds && log.gameIds.length > 0 ? (
                          <Chip label={`${log.gameIds.length} game${log.gameIds.length !== 1 ? "s" : ""}`} size="small" variant="outlined" />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleViewDetails(log.id)}
                              color="primary"
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {log.gameIds && log.gameIds.length > 0 && (
                            <Tooltip title="Re-open & Edit">
                              <IconButton
                                size="small"
                                onClick={() => handleReopenEdit(log.id)}
                                color="secondary"
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={pagination.total}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </Paper>
    </Box>
  );
}
