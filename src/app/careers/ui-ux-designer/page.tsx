"use client";

import { Box, Typography } from "@mui/material";
import BaseHeader from "@/components/headers/_base";

export default function UIUXDesignerPage() {
  return (
    <>
      <BaseHeader pt={"20px"} pl={"20px"} />
      <Box sx={{ maxWidth: 800, mx: "auto", p: 3 }}>
        <Typography variant="h4" gutterBottom>
          UI/UX Designer
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
          We&apos;re looking for a UI/UX Designer to craft intuitive,
          user-friendly experiences for our athletics management platform.
          You&apos;ll work closely with our product and engineering teams to
          design interfaces that help coaches, athletic directors, and parents
          navigate complex workflows with ease.
        </Typography>

        <Typography variant="h6" gutterBottom>
          Responsibilities
        </Typography>
        <Typography variant="body1" component="div" paragraph>
          <ul>
            <li>
              Design and prototype user interfaces for web and mobile
              applications
            </li>
            <li>
              Conduct user research and usability testing with school
              administrators, coaches, and parents
            </li>
            <li>
              Create wireframes, mockups, and interactive prototypes
            </li>
            <li>
              Develop and maintain a consistent design system and component
              library
            </li>
            <li>
              Collaborate with engineers to ensure designs are implemented
              accurately
            </li>
            <li>
              Iterate on designs based on user feedback and analytics
            </li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          Qualifications
        </Typography>
        <Typography variant="body1" component="div" paragraph>
          <ul>
            <li>
              3+ years of experience in UI/UX design for web or mobile
              applications
            </li>
            <li>
              Proficiency with design tools such as Figma, Sketch, or Adobe
              XD
            </li>
            <li>
              Strong portfolio demonstrating user-centered design thinking
            </li>
            <li>
              Experience with responsive design and accessibility best
              practices
            </li>
            <li>
              Excellent communication and collaboration skills
            </li>
            <li>
              Experience in education technology or sports technology is a
              plus
            </li>
          </ul>
        </Typography>

        <Typography variant="h6" gutterBottom>
          How to Apply
        </Typography>
        <Typography variant="body1" paragraph>
          Send your resume and portfolio to{" "}
          <a
            href="mailto:rstokes@opletics.com"
            style={{ color: "var(--text-primary)", fontWeight: 600 }}
          >
            rstokes@opletics.com
          </a>{" "}
          with the subject line &quot;UI/UX Designer Application.&quot;
        </Typography>
      </Box>
    </>
  );
}
