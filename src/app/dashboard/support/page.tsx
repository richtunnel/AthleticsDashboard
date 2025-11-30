import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { Box, Typography, Container } from "@mui/material";
import { SupportFormWithDropdown } from "@/components/support/SupportFormWithDropdown";
import { getFirstName } from "@/lib/utils/name";
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
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          Need help? We're here for you.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select your issue type and describe your problem. We'll get back to you within 48 hours at{" "}
          <strong>{session.user.email}</strong>.
        </Typography>
      </Box>

      <SupportFormWithDropdown
        userName={getFirstName(session.user.name) || ""}
        userEmail={session.user.email || ""}
      />
    </Container>
  );
}
