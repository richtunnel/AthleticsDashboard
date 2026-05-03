"use client";

import { Box, Typography } from "@mui/material";
import Link from "next/link";
import BaseHeader from "@/components/headers/_base";

const positions = [
  {
    title: "UI/UX Designer",
    slug: "ui-ux-designer",
    type: "Full-Time",
    location: "Remote",
    summary:
      "Design intuitive, engaging interfaces for our athletics management platform used by schools and athletic programs nationwide.",
  },
  {
    title: "Athletic Director",
    slug: "athletic-director",
    type: "Full-Time",
    location: "Remote",
    summary:
      "Leverage your athletics leadership experience to shape product strategy and help schools manage their athletic programs more effectively.",
  },
  {
    title: "Educational Sales Consultant",
    slug: "educational-sales-consultant",
    type: "Full-Time",
    location: "Remote",
    summary:
      "Build relationships with schools and athletic organizations, helping them discover how Opletics can streamline their programs.",
  },
];

export default function CareersClient() {
  return (
    <>
      <BaseHeader pt={"20px"} pl={"20px"} />
      <Box sx={{ maxWidth: 800, mx: "auto", p: 3 }}>
        <h1 className="text-4xl font-bold mb-4">Careers at Opletics</h1>
        <Typography variant="body1" paragraph>
          We&apos;re building the future of school athletics management and athlete management systems. Join
          our team and help empower athletic programs across the country.
        </Typography>

        <h2 className="text-2xl font-semibold mb-4 mt-8">Open Positions</h2>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {positions.map((position) => (
            <Link
              key={position.slug}
              href={`/careers/${position.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Box
                sx={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 2,
                  p: 3,
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  "&:hover": {
                    borderColor: "var(--accent)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  },
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, mb: 0.5 }}
                >
                  {position.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "var(--text-secondary)", mb: 1 }}
                >
                  {position.type} &middot; {position.location}
                </Typography>
                <Typography variant="body2">{position.summary}</Typography>
              </Box>
            </Link>
          ))}
        </Box>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 4 }}
        >
          Don&apos;t see a role that fits? Send your resume to{" "}
          <a
            href="mailto:rstokes@opletics.com"
            style={{ color: "var(--text-primary)" }}
          >
            rstokes@opletics.com
          </a>{" "}
          and tell us how you&apos;d like to contribute.
        </Typography>
      </Box>
    </>
  );
}
