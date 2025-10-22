"use client";

import { Box, Typography, Link } from "@mui/material";
import BaseHeader from "@/components/headers/_base";

export default function TermsPage() {
  return (
    <>
      <BaseHeader pt={"20px"} pl={"20px"} />
      <Box sx={{ maxWidth: 800, mx: "auto", p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Terms of Service
        </Typography>
        <Typography variant="body1" paragraph>
          Welcome to the Athletics Dashboard. By using our platform, you agree to comply with and be bound by the following Terms of Service ("Terms"). Please read these Terms carefully. If you do not
          agree with these Terms, you must not use our platform.
        </Typography>

        <Typography variant="h6" gutterBottom>
          1. Acceptance of Terms
        </Typography>
        <Typography variant="body1" paragraph>
          By accessing or using the Athletics Dashboard, you confirm that you are an authorized representative of a school or athletic organization (e.g., an athletic director, coach, or
          administrator) and agree to these Terms on behalf of yourself and your organization.
        </Typography>

        <Typography variant="h6" gutterBottom>
          2. Accurate Information
        </Typography>
        <Typography variant="body1" paragraph>
          You agree to provide accurate, complete, and current information when using the Athletics Dashboard, including but not limited to school name, team name, mascot, and other details. Providing
          false, misleading, or fraudulent information is strictly prohibited and may result in immediate account termination.
        </Typography>

        <Typography variant="h6" gutterBottom>
          3. Appropriate Use and Conduct
        </Typography>
        <Typography variant="body1" paragraph>
          The Athletics Dashboard is intended for managing school athletic programs. You agree to use the platform in a manner consistent with school policies, codes of conduct, and applicable laws.
          Prohibited activities include:
          <ul>
            <li>Using the platform to misrepresent your school or team.</li>
            <li>Engaging in harassment, bullying, or discriminatory behavior.</li>
            <li>Sharing or uploading content that violates school policies or is offensive, obscene, or inappropriate.</li>
            <li>Attempting to access, modify, or delete data belonging to other users without authorization.</li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          4. Data Ownership and Use
        </Typography>
        <Typography variant="body1" paragraph>
          You retain ownership of the data you provide (e.g., school details, team rosters). However, by submitting data, you grant Athletics Dashboard a non-exclusive, royalty-free license to use,
          store, and process this data to provide our services. You are responsible for ensuring that all data complies with applicable laws, including student privacy regulations (e.g., FERPA).
        </Typography>

        <Typography variant="h6" gutterBottom>
          5. Account Security
        </Typography>
        <Typography variant="body1" paragraph>
          You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. Notify us immediately at{" "}
          <Link href="mailto:support@athleticsdashboard.com">support@athleticsdashboard.com</Link> if you suspect unauthorized access.
        </Typography>

        <Typography variant="h6" gutterBottom>
          6. Compliance with Laws
        </Typography>
        <Typography variant="body1" paragraph>
          You agree to comply with all applicable local, state, and federal laws, including those related to student data privacy (e.g., FERPA, COPPA) and intellectual property. The Athletics
          Dashboard is not responsible for your failure to comply with these laws.
        </Typography>

        <Typography variant="h6" gutterBottom>
          7. Termination
        </Typography>
        <Typography variant="body1" paragraph>
          We reserve the right to suspend or terminate your account for violations of these Terms, including providing false information or engaging in inappropriate conduct. Upon termination, your
          access to the platform will cease, and we may delete your data in accordance with our Privacy Policy.
        </Typography>

        <Typography variant="h6" gutterBottom>
          8. Limitation of Liability
        </Typography>
        <Typography variant="body1" paragraph>
          The Athletics Dashboard is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the platform, including data loss, unauthorized access,
          or service interruptions.
        </Typography>

        <Typography variant="h6" gutterBottom>
          9. Changes to Terms
        </Typography>
        <Typography variant="body1" paragraph>
          We may update these Terms at any time. You will be notified of significant changes via email or through the platform. Continued use of the Athletics Dashboard after changes constitutes
          acceptance of the new Terms.
        </Typography>

        <Typography variant="h6" gutterBottom>
          10. Contact Us
        </Typography>
        <Typography variant="body1" paragraph>
          For questions or concerns about these Terms, please contact us at <Link href="mailto:support@athleticsdashboard.com">support@athleticsdashboard.com</Link>.
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
          Last updated: October 22, 2025
        </Typography>
      </Box>
    </>
  );
}
