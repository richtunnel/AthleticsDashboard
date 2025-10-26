import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { Box, Typography, Chip, Breadcrumbs, Link as MuiLink } from "@mui/material";
import Link from "next/link";
import { SupportFeedbackForm } from "@/components/support/SupportFeedbackForm";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";

interface PageProps {
  params: Promise<{ ticketNumber: string }>;
}

export default async function SupportTicketPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const { ticketNumber } = await params;

  const ticket = await prisma.supportTicket.findUnique({
    where: { ticketNumber },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          organizationId: true,
        },
      },
    },
  });

  if (!ticket) {
    notFound();
  }

  // Verify ownership or organization
  if (ticket.userId !== session.user.id && ticket.user?.organizationId !== session.user.organizationId) {
    redirect("/dashboard");
  }

  const statusColors = {
    OPEN: "primary",
    PENDING_RESPONSE: "warning",
    CLOSED: "default",
  } as const;

  return (
    <>
      <Box sx={{ px: 3, py: 3 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          sx={{ mb: 2 }}
        >
          <MuiLink
            component={Link}
            href="/dashboard"
            underline="hover"
            color="inherit"
          >
            Dashboard
          </MuiLink>
          <Typography color="text.primary">Support Ticket</Typography>
        </Breadcrumbs>

        {/* Page Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
            <Typography variant="h4">Support Ticket</Typography>
            <Chip
              label={ticket.status.replace("_", " ")}
              color={statusColors[ticket.status]}
              size="small"
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Ticket #{ticket.ticketNumber}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Created on {new Date(ticket.createdAt).toLocaleDateString()}
          </Typography>
        </Box>

        {/* Form */}
        <SupportFeedbackForm
          mode="support"
          userName={ticket.name}
          ticketNumber={ticket.ticketNumber}
          initialSubject={ticket.subject}
          initialDescription={ticket.description || ticket.initialMessage}
        />
      </Box>
    </>
  );
}
