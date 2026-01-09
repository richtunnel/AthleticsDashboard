import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { Box, Typography, Container, Divider } from "@mui/material";
import { SupportFormWithDropdown } from "@/components/support/SupportFormWithDropdown";
import { TicketList } from "@/components/support/TicketList";
import { redirect } from "next/navigation";

export default async function DashboardSupportPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
          Contact Support
        </Typography>
        <Typography variant="h6" color="text.primary" sx={{ mb: 1 }}>
          We&apos;re here for you.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select your issue type and describe your problem. We&apos;ll get back to you within 48 hours.
        </Typography>
      </Box>

      {/* Ticket List */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          Your Tickets
        </Typography>
        <TicketList />
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Support Form */}
      <Box sx={{ mb: 4, width: "100%" }}>
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
          Create New Ticket
        </Typography>
        <Typography variant="body1">Please fill out all fields.</Typography>
      </Box>
      <SupportFormWithDropdown />
    </Container>
  );
}
