"use client";

import { Box, Typography, Link } from "@mui/material";
import BaseHeader from "@/components/headers/_base";

export default function IncidentResponsePage() {
  return (
    <>
      <BaseHeader pt={"20px"} pl={"20px"} />
      <Box sx={{ maxWidth: 800, mx: "auto", p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Incident Response Procedures
        </Typography>
        <Typography variant="body1" paragraph>
          At Opletics, we take security seriously and are committed to protecting the data and privacy of our users. This document outlines our incident response procedures for handling security incidents
          and vulnerabilities. It provides guidance for users and security researchers on how to report incidents and what to expect during our response process.
        </Typography>

        <Typography variant="h6" gutterBottom>
          1. What Constitutes a Security Incident?
        </Typography>
        <Typography variant="body1" paragraph>
          A security incident is any event that compromises the confidentiality, integrity, or availability of Opletics systems or data. Examples include:
          <ul>
            <li>
              <strong>Data Breach</strong>: Unauthorized access, disclosure, or acquisition of sensitive user data (e.g., personal information, account credentials, school or team data).
            </li>
            <li>
              <strong>Unauthorized Access</strong>: Any evidence that an unauthorized individual has accessed user accounts, administrative systems, or databases.
            </li>
            <li>
              <strong>Service Disruption</strong>: Attacks or events that cause significant service interruptions, such as Distributed Denial of Service (DDoS) attacks.
            </li>
            <li>
              <strong>Malware or Malicious Code</strong>: Detection of malware, ransomware, or other malicious software affecting our systems.
            </li>
            <li>
              <strong>Vulnerability Exploitation</strong>: Active exploitation of known or unknown vulnerabilities in our platform.
            </li>
            <li>
              <strong>Phishing or Social Engineering</strong>: Reports of phishing campaigns targeting Opletics users or attempts to impersonate Opletics staff.
            </li>
            <li>
              <strong>Authentication Issues</strong>: Suspicious login patterns, account takeover attempts, or credential stuffing attacks.
            </li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          2. Reporting a Security Incident
        </Typography>
        <Typography variant="body1" paragraph>
          If you discover or suspect a security incident, please report it immediately. Include as much detail as possible to help us investigate and respond effectively.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>How to Report:</strong>
          <ul>
            <li>
              <strong>Email</strong>: Contact us at{" "}
              <Link href="mailto:security@opletics.com">security@opletics.com</Link>. This is our preferred method for reporting incidents.
            </li>
            <li>
              <strong>Include the Following Information</strong>:
              <ul>
                <li>Your name and contact information</li>
                <li>Description of the incident or vulnerability</li>
                <li>Steps to reproduce the issue (if applicable)</li>
                <li>Screenshots, logs, or other evidence</li>
                <li>Timestamp and timezone of the incident</li>
                <li>Any affected systems or data</li>
              </ul>
            </li>
            <li>
              <strong>For Vulnerabilities</strong>: If you are a security researcher and have discovered a vulnerability, please follow our responsible disclosure guidelines (see Section 5).
            </li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          3. Incident Response Process
        </Typography>
        <Typography variant="body1" paragraph>
          Upon receiving a report, Opletics follows a structured incident response process to minimize impact and restore normal operations as quickly as possible.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Phase 1: Triage and Identification (0-2 hours)</strong>
          <ul>
            <li>Review the incident report and verify its severity.</li>
            <li>Determine if the incident is confirmed, suspected, or a false positive.</li>
            <li>Assign a severity level (Low, Medium, High, or Critical).</li>
            <li>Notify the incident response team and relevant stakeholders.</li>
          </ul>
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Phase 2: Containment (2-24 hours)</strong>
          <ul>
            <li>Take immediate steps to contain the incident and prevent further damage.</li>
            <li>Isolate affected systems or accounts if necessary.</li>
            <li>Implement temporary mitigations while a permanent fix is developed.</li>
            <li>Preserve evidence for forensic analysis.</li>
          </ul>
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Phase 3: Eradication and Recovery (24-72 hours)</strong>
          <ul>
            <li>Identify the root cause of the incident.</li>
            <li>Remove malicious code, close vulnerabilities, or address the issue.</li>
            <li>Restore affected systems and data from backups if needed.</li>
            <li>Verify that the issue has been fully resolved.</li>
          </ul>
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Phase 4: Post-Incident Review (7-14 days)</strong>
          <ul>
            <li>Conduct a thorough review of the incident and response process.</li>
            <li>Document lessons learned and identify areas for improvement.</li>
            <li>Update security policies and procedures as needed.</li>
            <li>Communicate findings to affected users if required.</li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          4. Communication and Transparency
        </Typography>
        <Typography variant="body1" paragraph>
          We are committed to transparent communication during and after security incidents.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Communication Timeline:</strong>
          <ul>
            <li>
              <strong>Initial Acknowledgment</strong>: You will receive an acknowledgment within 24 hours of submitting a report. This confirms we have received your report and are investigating.
            </li>
            <li>
              <strong>Updates for Critical Incidents</strong>: For incidents affecting user data or service availability, we will provide updates at least every 48 hours until resolved.
            </li>
            <li>
              <strong>Final Resolution</strong>: Once the incident is resolved, we will provide a summary of what happened, how it was addressed, and any steps users should take (e.g., changing passwords).
            </li>
            <li>
              <strong>Public Disclosure</strong>: If an incident involves a significant data breach or widespread impact, we will issue a public statement and comply with applicable notification laws (e.g., state breach notification laws, GDPR).
            </li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          5. Responsible Disclosure Policy for Security Researchers
        </Typography>
        <Typography variant="body1" paragraph>
          We value the contributions of the security community and encourage responsible disclosure of vulnerabilities. If you discover a vulnerability in our systems, please:
        </Typography>
        <Typography variant="body1" paragraph>
          <ul>
            <li>Report it to us via <Link href="mailto:security@opletics.com">security@opletics.com</Link> before disclosing it publicly.</li>
            <li>Provide sufficient details to help us understand and reproduce the issue.</li>
            <li>Allow us reasonable time (typically 90 days) to investigate and address the vulnerability.</li>
            <li>Avoid exploiting the vulnerability for any malicious purpose, including accessing, modifying, or deleting user data.</li>
            <li>Do not engage in activities that could disrupt service for other users (e.g., DDoS testing, automated scanning that impacts performance).</li>
          </ul>
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>What You Can Expect:</strong>
          <ul>
            <li>We will acknowledge your report within 24 hours.</li>
            <li>We will keep you updated on our progress and timeline for remediation.</li>
            <li>We will credit you in our security advisories if you wish to be recognized (with your permission).</li>
            <li>We do not currently offer a bug bounty program, but we appreciate responsible disclosures and may offer recognition or other non-monetary rewards.</li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          6. Data Breach Notification
        </Typography>
        <Typography variant="body1" paragraph>
          In the event of a confirmed data breach involving personal information, we will:
        </Typography>
        <Typography variant="body1" paragraph>
          <ul>
            <li>Notify affected users as soon as practicable, and in compliance with applicable laws (e.g., within 72 hours for GDPR, or as required by state breach notification laws).</li>
            <li>Provide clear information about what data was affected, the risks involved, and steps users can take to protect themselves.</li>
            <li>Work with law enforcement and regulatory authorities as required.</li>
            <li>Take steps to prevent future incidents and improve our security posture.</li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          7. User Responsibilities
        </Typography>
        <Typography variant="body1" paragraph>
          While we take extensive measures to secure our platform, users also play a role in maintaining security:
        </Typography>
        <Typography variant="body1" paragraph>
          <ul>
            <li>
              <strong>Use Strong Passwords</strong>: Choose unique, complex passwords and enable two-factor authentication (when available).
            </li>
            <li>
              <strong>Report Suspicious Activity</strong>: If you notice unusual account activity, unauthorized logins, or phishing attempts, report them immediately.
            </li>
            <li>
              <strong>Keep Software Updated</strong>: Ensure your browser and devices are up-to-date with the latest security patches.
            </li>
            <li>
              <strong>Be Cautious with Links and Attachments</strong>: Avoid clicking on suspicious links or downloading attachments from unknown sources.
            </li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          8. Contact Us
        </Typography>
        <Typography variant="body1" paragraph>
          For security-related inquiries, incident reports, or vulnerability disclosures, please contact us at{" "}
          <Link href="mailto:security@opletics.com">security@opletics.com</Link>.
        </Typography>
        <Typography variant="body1" paragraph>
          For general support inquiries, please visit our <Link href="/support">Support page</Link> or contact{" "}
          <Link href="mailto:support@opletics.com">support@opletics.com</Link>.
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
          Last updated: March 5, 2025
        </Typography>
      </Box>
    </>
  );
}
