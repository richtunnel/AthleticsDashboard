"use client";

import { Box, Typography } from "@mui/material";
import BaseHeader from "@/components/headers/_base";

export default function EducationalSalesConsultantPage() {
  return (
    <>
      <BaseHeader pt={"20px"} pl={"20px"} />
      <Box sx={{ maxWidth: 800, mx: "auto", p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Educational Sales Consultant
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "var(--text-secondary)", mb: 3 }}
        >
          Full-Time &middot; Remote
        </Typography>

        <Typography variant="h6" gutterBottom>
          About the Role
        </Typography>
        <Typography variant="body1" paragraph>
          We&apos;re looking for an Educational Sales Consultant to help
          schools and athletic organizations discover the value of Opletics.
          You&apos;ll be responsible for building relationships with school
          decision-makers, understanding their needs, and demonstrating how our
          platform can streamline their athletic programs.
        </Typography>

        <Typography variant="h6" gutterBottom>
          Responsibilities
        </Typography>
        <Typography variant="body1" component="div" paragraph>
          <ul>
            <li>
              Identify and engage prospective school districts and athletic
              organizations
            </li>
            <li>
              Conduct product demonstrations and presentations to
              administrators and athletic directors
            </li>
            <li>
              Manage the full sales cycle from prospecting to onboarding
            </li>
            <li>
              Build and maintain long-term relationships with school partners
            </li>
            <li>
              Collaborate with the product team to relay customer feedback and
              feature requests
            </li>
            <li>
              Attend education and athletics conferences to generate leads
            </li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          Qualifications
        </Typography>
        <Typography variant="body1" component="div" paragraph>
          <ul>
            <li>
              3+ years of experience in education sales, SaaS sales, or a
              related field
            </li>
            <li>
              Understanding of the K-12 education market and procurement
              processes
            </li>
            <li>
              Proven track record of meeting or exceeding sales targets
            </li>
            <li>
              Excellent presentation and interpersonal skills
            </li>
            <li>
              Self-motivated with the ability to work independently in a
              remote environment
            </li>
            <li>
              Experience in education technology or athletics is a plus
            </li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          How to Apply
        </Typography>
        <Typography variant="body1" paragraph>
          Send your resume to{" "}
          <a
            href="mailto:rstokes@opletics.com"
            style={{ color: "var(--text-primary)", fontWeight: 600 }}
          >
            rstokes@opletics.com
          </a>{" "}
          with the subject line &quot;Educational Sales Consultant
          Application.&quot;
        </Typography>
      </Box>
    </>
  );
}
