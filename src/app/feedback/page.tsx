import type { Metadata } from "next";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { Box, Typography } from "@mui/material";
import { SupportFeedbackForm } from "@/components/support/SupportFeedbackForm";
import { GoogleFeedbackForm } from "@/components/support/GoogleFeedbackForm";
import Footer from "@/components/layout/Footer";
import BaseHeader from "@/components/headers/_base";
import { getFirstName } from "@/lib/utils/name";

export const metadata: Metadata = {
  title: "Feedback",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PublicFeedbackPage() {
  const session = await getServerSession(authOptions);
  const googleFormsUrl = process.env.NEXT_PUBLIC_GOOGLE_FORMS_FEEDBACK_URL;

  return (
    <>
      <BaseHeader pt="20px" pl="20px" />
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Box sx={{ px: 3, py: 3, maxWidth: 900, mx: "auto", flex: 1 }}>
          {googleFormsUrl ? (
            <GoogleFeedbackForm formUrl={googleFormsUrl} />
          ) : (
            <>
              <Box sx={{ mb: 4 }}>
                <Typography variant="h4" sx={{ mb: 1 }}>
                  Share Your Feedback
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  We value your feedback! Please let us know how we can improve your experience.
                </Typography>
              </Box>
              <SupportFeedbackForm mode="feedback" userName={getFirstName(session?.user?.name) || ""} userEmail={session?.user?.email || ""} isPublic={!session?.user} />
            </>
          )}
        </Box>
        <Footer />
      </Box>
    </>
  );
}
