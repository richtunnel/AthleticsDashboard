"use client";

import { Box, Container, Typography, Button, Stack } from "@mui/material";
import { ErrorOutline } from "@mui/icons-material";
import TopFooter from "@/components/footer/topFooter";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CircularProjectIcon } from "@/components/circle-logo/OpleticsLogo";

function useHomeHref(): string {
  const { data: session, status } = useSession();
  if (status === "loading") return "/";
  if (!session) return "/";
  if (session.user?.role === "PARENT") return "/parent-dashboard";
  return "/dashboard";
}

export default function NotFound() {
  const homeHref = useHomeHref();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Link href={homeHref} style={{ textDecoration: "none" }}>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <CircularProjectIcon outerStrokeWidth={2} strokeWidth={4} />
            <Typography variant="h6" fontWeight={800} sx={{ color: "text.primary", letterSpacing: "-0.65px", lineHeight: 1 }}>
              opletics
            </Typography>
          </Stack>
        </Link>
      </Box>
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
              href={homeHref}
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
