"use client";

import { Box, Button, Container, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { ArrowBack } from "@mui/icons-material";
import Link from "next/link";
import { useSession } from "next-auth/react";
import NewsFeed from "@/components/posts/NewsFeed";

export default function NewsPage() {
  const theme = useTheme();
  const { data: session } = useSession();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: theme.palette.mode === "dark" ? "background.default" : "#f3f4f6",
      }}
    >
      {/* Top bar */}
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: theme.palette.mode === "dark" ? "background.paper" : "#fff",
          borderBottom: "1px solid",
          borderColor: "divider",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <Container maxWidth="lg" sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, maxWidth: 992 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexGrow: 1 }}>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                Opletics News
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Athletic director updates &amp; moments
              </Typography>
            </Box>
          </Box>
          {session && (
            <>
              <Button component={Link} href="/dashboard/posts" variant="contained" size="small" sx={{ borderRadius: 4, fontWeight: 600, textTransform: "none", display: { xs: "none", sm: "flex" } }}>
                Post an update
              </Button>
              <Button component={Link} href="/dashboard" size="small" startIcon={<ArrowBack sx={{ fontSize: 16 }} />} sx={{ textTransform: "none", color: "text.secondary", fontSize: 13 }}>
                Dashboard
              </Button>
            </>
          )}
        </Container>
      </Box>

      {/* Feed */}
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ maxWidth: 992, mx: "auto" }}>
          <NewsFeed queryKey="public-news-feed" />
        </Box>
      </Container>
    </Box>
  );
}
