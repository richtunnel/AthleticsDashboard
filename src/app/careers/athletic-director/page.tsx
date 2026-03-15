"use client";

import { Box, Typography } from "@mui/material";
import BaseHeader from "@/components/headers/_base";

export default function AthleticDirectorPage() {
  return (
    <>
      <BaseHeader pt={"20px"} pl={"20px"} />
      <Box sx={{ maxWidth: 800, mx: "auto", p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Athletic Director
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
          We&apos;re seeking an experienced Athletic Director to join our team
          and help shape the future of athletics management technology.
          You&apos;ll bring real-world experience from leading school athletic
          programs and apply it to building better tools for athletic directors
          nationwide.
        </Typography>

        <Typography variant="h6" gutterBottom>
          Responsibilities
        </Typography>
        <Typography variant="body1" component="div" paragraph>
          <ul>
            <li>
              Provide subject matter expertise on athletic program management
              workflows and pain points
            </li>
            <li>
              Guide product development to ensure features align with the
              needs of school athletic departments
            </li>
            <li>
              Build and maintain relationships with school districts and
              athletic conferences
            </li>
            <li>
              Develop training materials and onboarding processes for new
              school partners
            </li>
            <li>
              Represent Opletics at athletic conferences and education events
            </li>
            <li>
              Collaborate with the product team to prioritize feature
              development
            </li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          Qualifications
        </Typography>
        <Typography variant="body1" component="div" paragraph>
          <ul>
            <li>
              5+ years of experience as an Athletic Director or in a senior
              athletics administration role
            </li>
            <li>
              Deep understanding of school athletics operations, compliance,
              and scheduling
            </li>
            <li>
              Experience working with state athletic associations and
              governing bodies
            </li>
            <li>
              Strong organizational and communication skills
            </li>
            <li>
              Passion for leveraging technology to improve athletics programs
            </li>
            <li>
              Experience with athletics management software is a plus
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
          with the subject line &quot;Athletic Director Application.&quot;
        </Typography>
      </Box>
    </>
  );
}
