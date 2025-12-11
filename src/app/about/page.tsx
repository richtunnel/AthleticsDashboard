"use client";

import { Box, Typography, Container } from "@mui/material";
import BaseHeader from "@/components/headers/_base";

export default function AboutUsPage() {
  return (
    <>
      <BaseHeader pt={"20px"} pl={"20px"} />
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Box
          sx={{
            textAlign: "center",
            mb: 6,
          }}
        >
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 700,
              color: "text.primary",
              mb: 2,
            }}
          >
            About Us
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: "primary.main",
              mb: 1,
            }}
          >
            Built by athletic directors and school administrators,
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: "text.secondary",
            }}
          >
            for the people who lead our programs.
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography
            variant="body1"
            paragraph
            sx={{
              fontSize: "1.125rem",
              lineHeight: 1.8,
              color: "text.primary",
            }}
          >
            AD Hub was created with one mission: to give athletic departments and school leadership the modern tools they deserve. After decades of watching athletic directors, coaches, and administrators juggle spreadsheets, emails, forms, and outdated systems, we knew the industry needed something better - something built by people who truly understand the challenges of running a successful school athletic program.
          </Typography>

          <Typography
            variant="body1"
            paragraph
            sx={{
              fontSize: "1.125rem",
              lineHeight: 1.8,
              color: "text.primary",
            }}
          >
            With over 50 years of combined experience across athletics, school administration, education, and technology, our team brings together the people who have lived the problems and the experts who know how to solve them. From former athletic directors and school administrators to seasoned software professionals, we've built a platform that blends real-world insight with cutting-edge innovation.
          </Typography>

          <Typography
            variant="body1"
            paragraph
            sx={{
              fontSize: "1.125rem",
              lineHeight: 1.8,
              color: "text.primary",
              fontWeight: 600,
              mt: 3,
            }}
          >
            At AD Hub, you're not just in good hands, you're in experienced, trusted, industry-tested hands.
          </Typography>

          <Typography
            variant="body1"
            paragraph
            sx={{
              fontSize: "1.125rem",
              lineHeight: 1.8,
              color: "text.primary",
            }}
          >
            We're committed to helping athletic directors and school administrators lead with confidence, reclaim their time, and elevate their programs without the administrative overwhelm. This isn't generic software trying to fit your world - this is a platform built specifically for it.
          </Typography>
        </Box>

        <Box
          sx={{
            mt: 6,
            p: 4,
            bgcolor: "action.hover",
            borderRadius: 2,
            textAlign: "center",
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: "text.primary",
              mb: 2,
            }}
          >
            Ready to experience the difference?
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: "text.secondary",
            }}
          >
            Join athletic directors and school administrators who are already using AD Hub to transform their programs.
          </Typography>
        </Box>
      </Container>
    </>
  );
}
