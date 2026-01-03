import type { Metadata } from "next";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { Box, Typography } from "@mui/material";
import { SupportFeedbackForm } from "@/components/support/SupportFeedbackForm";
import Footer from "@/components/layout/Footer";
import BaseHeader from "@/components/headers/_base";
import styles from "@/styles/custom.form.module.css";
import { getFirstName } from "@/lib/utils/name";
import BookDemoButton from "@/components/buttons/BookDemoButton";

export const metadata: Metadata = {
  title: "Support",
  description: "Contact Opletics support. We typically respond within 48 hours.",
  alternates: {
    canonical: "/support",
  },
};

export default async function PublicFeedbackPage() {
  const session = await getServerSession(authOptions);

  return (
    <>
      <BaseHeader pt="20px" pl="20px">
        <BookDemoButton calendlyUrl={process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com/opletics/30min"} />
      </BaseHeader>
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Box className={`${styles.supportContainer}`} sx={{ px: 3, py: 3, maxWidth: "100%", mx: "auto", flex: 1 }}>
          <Box sx={{ mb: 4, textAlign: "center" }}>
            <Typography variant="h4" sx={{ mb: 1, textAlign: "center" }}>
              We are here to help.
            </Typography>
            <Typography variant="body1" color="text.secondary">
              We value your time and will respond within 48 hours! <br />
              Please let us know how we can improve your experience.
            </Typography>
          </Box>

          <SupportFeedbackForm mode="support" userName={getFirstName(session?.user?.name) || ""} userEmail={session?.user?.email || ""} isPublic={!session?.user} />
        </Box>
        <Footer />
      </Box>
    </>
  );
}
