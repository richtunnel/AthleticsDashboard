"use client";

import { Card, CardContent, Typography, Box, Chip, Skeleton } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";

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
    OPEN: "primary",
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
            cursor: "pointer",
            transition: "all 0.2s",
            "&:hover": {
              bgcolor: "action.hover",
              boxShadow: 2,
            },
          }}
          onClick={() => router.push(`/dashboard/support/${ticket.ticketNumber}`)}
        >
          <CardContent>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
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
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
