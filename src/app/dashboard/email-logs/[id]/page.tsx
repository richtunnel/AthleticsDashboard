"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Button,
  Divider,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import { ArrowBack, CheckCircle as CheckCircleIcon, Error as ErrorIcon, Schedule as ScheduleIcon, Edit, Send, Delete } from "@mui/icons-material";
import { format } from "date-fns";
import { formatLevelDisplay } from "@/lib/utils/formatters";

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

interface Game {
  id: string;
  date: string;
  time: string | null;
  status: string;
  isHome: boolean;
  homeTeam: {
    name: string;
    level: string;
    sport: {
      name: string;
    };
  };
  opponent: {
    id?: string;
    name: string;
  } | null;
  venue: {
    name: string;
  } | null;
  notes: string | null;
}

export default function EmailLogDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const id = params?.id as string;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const {
    data: response,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["email-log", id],
    queryFn: async () => {
      const res = await fetch(`/api/email-logs/${id}`);
      if (!res.ok) throw new Error("Failed to fetch email log");
      return res.json();
    },
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/email-logs/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete email log");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-logs"] });
      router.push("/dashboard/email-logs");
    },
  });

  const log: EmailLog | null = response?.data?.log || null;
  const games: Game[] = response?.data?.games || [];

  const handleReopenEdit = async () => {
    if (!log) return;

    try {
      // Store data in sessionStorage and navigate to compose page
      if (games && games.length > 0) {
        sessionStorage.setItem("selectedGames", JSON.stringify(games));
        sessionStorage.setItem(
          "emailDraft",
          JSON.stringify({
            subject: log.subject,
            additionalMessage: log.additionalMessage || "",
            recipientCategory: log.recipientCategory || "parents",
          })
        );
        router.push("/dashboard/compose-email");
      } else {
        alert("No games associated with this email to re-send");
      }
    } catch (error) {
      console.error("Failed to reopen email:", error);
      alert("Failed to load email for editing");
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    deleteMutation.mutate();
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const getStatusChip = (status: string) => {
    const statusConfig: Record<string, { color: "success" | "error" | "warning" | "default"; label: string; icon: React.ReactElement | undefined }> = {
      SENT: { color: "success", label: "Sent", icon: <CheckCircleIcon fontSize="small" /> },
      FAILED: { color: "error", label: "Failed", icon: <ErrorIcon fontSize="small" /> },
      PENDING: { color: "warning", label: "Pending", icon: <ScheduleIcon fontSize="small" /> },
    };

    const config = statusConfig[status] || { color: "default" as const, label: status, icon: undefined };
    return <Chip label={config.label} color={config.color} icon={config.icon} />;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return format(new Date(dateString), "MMM d, yyyy h:mm a");
    } catch (error) {
      return dateString;
    }
  };

  const formatGameDate = (dateString: string) => {
    try {
      // Parse the date as UTC to avoid timezone shifts
      const date = new Date(dateString);
      // Extract the UTC date parts to ensure consistent display
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      // Format using UTC components directly to avoid timezone conversion issues
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${monthNames[month]} ${day}, ${year}`;
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

  if (error || !log) {
    return (
      <Box>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => router.back()} sx={{ mb: 3 }}>
          Back to Email Logs
        </Button>
        <Alert severity="error">Failed to load email log. It may have been deleted.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => router.back()} sx={{ mb: 3 }}>
        Back to Email Logs
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Email Log Details
      </Typography>

      <Stack spacing={3}>
        {/* Status and Actions */}
        <Paper sx={{ p: 3 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Status
              </Typography>
              {getStatusChip(log.status)}
            </Box>
            <Stack direction="row" spacing={2}>
              {log.gameIds && log.gameIds.length > 0 && (
                <Button variant="contained" startIcon={<Edit />} onClick={handleReopenEdit}>
                  Re-open & Edit
                </Button>
              )}
              <Button variant="outlined" color="error" startIcon={<Delete />} onClick={handleDeleteClick}>
                Delete
              </Button>
            </Stack>
          </Stack>

          {log.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Error:
              </Typography>
              <Typography variant="body2">{log.error}</Typography>
            </Alert>
          )}
        </Paper>

        {/* Email Details */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Email Details
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Subject
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {log.subject}
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Recipients ({log.to.length})
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {log.to.map((email, index) => (
                  <Chip key={index} label={email} size="small" variant="outlined" />
                ))}
              </Box>
            </Box>

            {log.cc && log.cc.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    CC ({log.cc.length})
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {log.cc.map((email, index) => (
                      <Chip key={index} label={email} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              </>
            )}

            <Divider />

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Sent At
              </Typography>
              <Typography variant="body1">{formatDate(log.sentAt)}</Typography>
            </Box>

            {log.recipientCategory && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Recipient Category
                  </Typography>
                  <Typography variant="body1" sx={{ textTransform: "capitalize" }}>
                    {log.recipientCategory.replace("_", " ")}
                  </Typography>
                </Box>
              </>
            )}

            {log.additionalMessage && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Additional Message
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: "#f8fafc" }}>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {log.additionalMessage}
                    </Typography>
                  </Paper>
                </Box>
              </>
            )}
          </Stack>
        </Paper>

        {/* Associated Games */}
        {games && games.length > 0 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Associated Games ({games.length})
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f8fafc" }}>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Sport</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Level</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Opponent</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Location</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {games.map((game) => (
                    <TableRow key={game.id} hover>
                      <TableCell>{formatGameDate(game.date)}</TableCell>
                      <TableCell>{game.homeTeam.sport.name}</TableCell>
                      <TableCell>{formatLevelDisplay(game.homeTeam.level)}</TableCell>
                      <TableCell>{game.opponent?.name || "TBD"}</TableCell>
                      <TableCell>{game.isHome ? "Home" : game.venue?.name || "TBD"}</TableCell>
                      <TableCell>
                        <Chip label={game.status} size="small" color={game.status === "CONFIRMED" ? "success" : "warning"} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* Email Body Preview */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Email Body Preview
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: "#ffffff",
              maxHeight: 500,
              overflow: "auto",
              "& img": { maxWidth: "100%" },
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: log.body }} />
          </Paper>
        </Paper>
      </Stack>

      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Email Log</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this email log? This action cannot be undone. You will be redirected back to the email logs list.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
