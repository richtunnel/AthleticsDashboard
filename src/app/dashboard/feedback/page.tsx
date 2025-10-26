import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/utils/authOptions";
import { Box, Typography, Breadcrumbs, Link as MuiLink } from "@mui/material";
import Link from "next/link";
import { SupportFeedbackForm } from "@/components/support/SupportFeedbackForm";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";

export default async function FeedbackPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

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
          <Typography color="text.primary">Feedback</Typography>
        </Breadcrumbs>

        {/* Page Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ mb: 1 }}>
            Share Your Feedback
          </Typography>
          <Typography variant="body1" color="text.secondary">
            We value your feedback! Please let us know how we can improve your experience.
          </Typography>
        </Box>

        {/* Form */}
        <SupportFeedbackForm
          mode="feedback"
          userName={session.user.name || "Unknown"}
        />
      </Box>
    </>
  );
}
