import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { Box, Typography } from "@mui/material";
import { SupportFeedbackForm } from "@/components/support/SupportFeedbackForm";
import Footer from "@/components/layout/Footer";

export default async function PublicFeedbackPage() {
  const session = await getServerSession(authOptions);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Box sx={{ px: 3, py: 3, maxWidth: 900, mx: "auto", flex: 1 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ mb: 1 }}>
            Share Your Feedback
          </Typography>
          <Typography variant="body1" color="text.secondary">
            We value your feedback! Please let us know how we can improve your experience.
          </Typography>
        </Box>

        <SupportFeedbackForm
          mode="feedback"
          userName={session?.user?.name || ""}
          userEmail={session?.user?.email || ""}
          isPublic={!session?.user}
        />
      </Box>
      <Footer />
    </Box>
  );
}
