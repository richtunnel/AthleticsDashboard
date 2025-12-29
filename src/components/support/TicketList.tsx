"use client";

import { Card, CardContent, Typography, Box, Chip, Skeleton, Button } from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import { useState } from "react";

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: "OPEN" | "PENDING_RESPONSE" | "CLOSED";
  createdAt: string;
  name: string;
}

export function TicketList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [closingTicketId, setClosingTicketId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ success: boolean; tickets: Ticket[] }>({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const res = await fetch("/api/support/tickets");
      if (!res.ok) {
        throw new Error("Failed to fetch tickets");
      }
      return res.json();
    },
  });

  const closeTicketMutation = useMutation({
    mutationFn: async (ticketNumber: string) => {
      const res = await fetch(`/api/support/${ticketNumber}/close`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to close ticket");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setClosingTicketId(null);
    },
    onError: (error) => {
      console.error("Failed to close ticket:", error);
      setClosingTicketId(null);
      alert("Failed to close ticket. Please try again.");
    },
  });

  const handleCloseTicket = (e: React.MouseEvent, ticketNumber: string, ticketId: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to close this ticket?")) {
      setClosingTicketId(ticketId);
      closeTicketMutation.mutate(ticketNumber);
    }
  };

  const handleViewTicket = (e: React.MouseEvent, ticketNumber: string) => {
    e.stopPropagation();
    router.push(`/dashboard/support/${ticketNumber}`);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {[1, 2, 3].map((i) => (
          <Card key={i} sx={{ boxShadow: "none" }}>
            <CardContent>
              <Skeleton variant="text" width="60%" height={30} />
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="30%" />
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  if (error) {
    return (
      <Card sx={{ boxShadow: "none" }}>
        <CardContent>
          <Typography color="error">Failed to load tickets. Please try again.</Typography>
        </CardContent>
      </Card>
    );
  }

  const tickets = data?.tickets || [];

  if (tickets.length === 0) {
    return (
      <Card sx={{ boxShadow: "none", bgcolor: "background.paper" }}>
        <CardContent>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 3 }}>
            <ConfirmationNumberIcon sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No tickets yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create your first support ticket below
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const statusColors = {
    OPEN: "success",
    PENDING_RESPONSE: "warning",
    CLOSED: "default",
  } as const;

  const statusLabels = {
    OPEN: "Open",
    PENDING_RESPONSE: "Pending Response",
    CLOSED: "Closed",
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {tickets.map((ticket) => (
        <Card
          key={ticket.id}
          sx={{
            boxShadow: "none",
            transition: "all 0.2s",
            "&:hover": {
              bgcolor: "action.hover",
              boxShadow: 2,
            },
          }}
        >
          <CardContent>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <Typography variant="h6" sx={{ fontSize: { xs: "1rem", md: "1.125rem" } }}>
                    {ticket.subject}
                  </Typography>
                  <Chip label={statusLabels[ticket.status]} color={statusColors[ticket.status]} size="small" />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Ticket #{ticket.ticketNumber}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Created on {new Date(ticket.createdAt).toLocaleDateString()} at {new Date(ticket.createdAt).toLocaleTimeString()}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 1, flexDirection: { xs: "column", sm: "row" } }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={(e) => handleViewTicket(e, ticket.ticketNumber)}
                >
                  View
                </Button>
                {ticket.status !== "CLOSED" && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={(e) => handleCloseTicket(e, ticket.ticketNumber, ticket.id)}
                    disabled={closingTicketId === ticket.id}
                  >
                    {closingTicketId === ticket.id ? "Closing..." : "Close"}
                  </Button>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
