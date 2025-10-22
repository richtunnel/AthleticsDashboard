"use client";

import { Box, Typography, Link } from "@mui/material";
import BaseHeader from "@/components/headers/_base";

export default function PrivacyPage() {
  return (
    <>
      <BaseHeader pt={"20px"} pl={"20px"} />
      <Box sx={{ maxWidth: 800, mx: "auto", p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Privacy Policy
        </Typography>
        <Typography variant="body1" paragraph>
          At Athletics Dashboard, we are committed to protecting your privacy and ensuring the security of your data. This Privacy Policy explains how we collect, use, disclose, and protect your
          information when you use our platform.
        </Typography>

        <Typography variant="h6" gutterBottom>
          1. Information We Collect
        </Typography>
        <Typography variant="body1" paragraph>
          We collect the following types of information:
          <ul>
            <li>
              <strong>Personal Information</strong>: Name, email address, phone number, and other details provided during account creation or school setup.
            </li>
            <li>
              <strong>School Information</strong>: School name, team name, mascot, and other data related to athletic programs.
            </li>
            <li>
              <strong>Usage Data</strong>: Information about how you interact with the platform, such as IP addresses, browser type, and pages visited.
            </li>
            <li>
              <strong>Authentication Data</strong>: Information collected through third-party authentication providers (e.g., Google, Microsoft) during sign-in.
            </li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          2. How We Use Your Information
        </Typography>
        <Typography variant="body1" paragraph>
          We use your information to:
          <ul>
            <li>Provide and improve the Athletics Dashboard services.</li>
            <li>Authenticate users and manage accounts.</li>
            <li>Communicate with you about updates, support, or account-related matters.</li>
            <li>Ensure compliance with school policies and applicable laws, such as FERPA.</li>
            <li>Analyze usage to enhance platform functionality and user experience.</li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          3. Data Sharing
        </Typography>
        <Typography variant="body1" paragraph>
          We do not sell or share your personal information with third parties except:
          <ul>
            <li>With your consent.</li>
            <li>With service providers who assist in operating the platform (e.g., cloud hosting, authentication services), under strict confidentiality agreements.</li>
            <li>To comply with legal obligations, such as responding to lawful requests or protecting our rights.</li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          4. Data Security
        </Typography>
        <Typography variant="body1" paragraph>
          We implement industry-standard security measures, including encryption and access controls, to protect your data. However, no system is completely secure, and you share data at your own
          risk.
        </Typography>

        <Typography variant="h6" gutterBottom>
          5. Student Data and FERPA Compliance
        </Typography>
        <Typography variant="body1" paragraph>
          The Athletics Dashboard complies with the Family Educational Rights and Privacy Act (FERPA). We do not collect or store student personally identifiable information (PII) unless explicitly
          provided by you and necessary for the platform's functionality. You are responsible for ensuring that any student data shared complies with FERPA and other applicable laws.
        </Typography>

        <Typography variant="h6" gutterBottom>
          6. Data Retention
        </Typography>
        <Typography variant="body1" paragraph>
          We retain your data only as long as necessary to provide our services or comply with legal obligations. You may request deletion of your account by contacting{" "}
          <Link href="mailto:support@athleticsdashboard.com">support@athleticsdashboard.com</Link>.
        </Typography>

        <Typography variant="h6" gutterBottom>
          7. Your Rights
        </Typography>
        <Typography variant="body1" paragraph>
          You have the right to access, update, or delete your personal information. Contact us at <Link href="mailto:support@athleticsdashboard.com">support@athleticsdashboard.com</Link> to exercise
          these rights.
        </Typography>

        <Typography variant="h6" gutterBottom>
          8. Third-Party Services
        </Typography>
        <Typography variant="body1" paragraph>
          The platform uses third-party services (e.g., Google, Microsoft for authentication) that have their own privacy policies. We are not responsible for their practices.
        </Typography>

        <Typography variant="h6" gutterBottom>
          9. Changes to Privacy Policy
        </Typography>
        <Typography variant="body1" paragraph>
          We may update this Privacy Policy. Significant changes will be communicated via email or through the platform. Continued use of the Athletics Dashboard after changes constitutes acceptance
          of the new policy.
        </Typography>

        <Typography variant="h6" gutterBottom>
          10. Contact Us
        </Typography>
        <Typography variant="body1" paragraph>
          For questions about this Privacy Policy, please contact us at <Link href="mailto:support@athleticsdashboard.com">support@athleticsdashboard.com</Link>.
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
          Last updated: October 22, 2025
        </Typography>
      </Box>
    </>
  );
}
