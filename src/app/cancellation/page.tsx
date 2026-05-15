"use client";

import { Box, Typography, Link } from "@mui/material";
import BaseHeader from "@/components/headers/_base";
import Footer from "@/components/layout/Footer";

export default function CancellationPolicyPage() {
  return (
    <>
      <BaseHeader pt="20px" pl="20px" />
      <Box sx={{ maxWidth: 800, mx: "auto", p: { xs: 2, md: 4 } }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Cancellation Policy
        </Typography>

        <Typography variant="body1" paragraph>
          We offer a <strong>2-week free trial</strong> for all new accounts. No credit card is required during your trial period, and you can explore all features without any commitment.
        </Typography>

        <Typography variant="h6" fontWeight={600} gutterBottom>
          Cancelling Your Subscription
        </Typography>
        <Typography variant="body1" paragraph>
          Subscriptions can be <strong>canceled at any time</strong>. You will retain access to your account until the end of your current billing period. We do not charge cancellation fees.
        </Typography>

        <Typography variant="h6" fontWeight={600} gutterBottom>
          How to Cancel
        </Typography>
        <Typography variant="body1" paragraph>
          Visit your Settings page in the Dashboard and select your billing plan to cancel your subscription
          <Link href="https://opletics.com/dashboard/settings" underline="hover">
            Visit Settings
          </Link>
        </Typography>
        <Typography variant="body1" paragraph>
          You will receive a confirmation email once your cancellation has been processed. If you do not receive a confirmation within 2 business days, please follow up with us.
        </Typography>

        <Typography variant="h6" fontWeight={600} gutterBottom>
          What Happens After Cancellation
        </Typography>
        <Typography variant="body1" paragraph>
          Once your subscription is canceled:
        </Typography>
        <Box component="ul" sx={{ pl: 3, mb: 2 }}>
          <li>
            <Typography variant="body1">Your account will remain active through the end of your paid billing period.</Typography>
          </li>
          <li>
            <Typography variant="body1">You will not be charged again after cancellation.</Typography>
          </li>
          <li>
            <Typography variant="body1">Your data will be retained for 30 days after cancellation in case you choose to reactivate.</Typography>
          </li>
        </Box>

        <Typography variant="h6" fontWeight={600} gutterBottom>
          Reactivation
        </Typography>
        <Typography variant="body1" paragraph>
          You can reactivate your subscription at any time by logging in and selecting a new plan, or by contacting us at{" "}
          <Link href="mailto:support@opletics.com" underline="hover">
            support@opletics.com
          </Link>
          .
        </Typography>

        <Typography variant="body1" paragraph>
          You can always contact us for any cancellation questions at{" "}
          <Link href="mailto:support@opletics.com" underline="hover">
            support@opletics.com
          </Link>
          .
        </Typography>
      </Box>
      <Footer />
    </>
  );
}
