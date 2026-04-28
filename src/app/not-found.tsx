"use client";

import { Box, Container, Typography, Button } from "@mui/material";
import { ErrorOutline } from "@mui/icons-material";
import BaseHeader from "@/components/headers/_base";
import TopFooter from "@/components/footer/topFooter";
import Link from "next/link";

export default function NotFound() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <BaseHeader pt="20px" pl="20px" />
      <Box
        component="main"
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: 8,
        }}
      >
        <Container maxWidth="sm">
          <Box sx={{ textAlign: "center" }}>
            <ErrorOutline sx={{ fontSize: 80, color: "text.secondary", mb: 2 }} />
            <Typography variant="h2" component="h1" fontWeight={700} gutterBottom>
              404
            </Typography>
            <Typography variant="h5" color="text.secondary" gutterBottom>
              Page Not Found
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or deleted.
            </Typography>
            <Button
              variant="contained"
              component={Link}
              href="/"
              size="large"
              sx={{ borderRadius: 2, px: 4 }}
            >
              Back to Home
            </Button>
          </Box>
        </Container>
      </Box>
      <TopFooter />
    </Box>
  );
}
