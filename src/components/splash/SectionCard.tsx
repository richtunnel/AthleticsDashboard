"use client";

import { Box, Container, Stack, Typography, IconButton, Chip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Image from "next/image";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { ButtonLink } from "../../components/splash/button-link";
import { useEffect, useState } from "react";

export const ArcCard: React.FC = () => {
  const theme = useTheme();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
        <Box
          sx={{
            bgcolor: theme.palette.mode === "light" ? "grey.50" : "grey.800",
            borderRadius: 4,
            p: { xs: 3, md: 5 },
            boxShadow: 2,
          }}
        >
          <Stack direction={{ xs: "column", lg: "row" }} spacing={{ xs: 3, lg: 5 }} alignItems="center">
            {/* left image */}
            <Box
              sx={{
                flex: "0 0 42%",
                maxWidth: { xs: "100%", lg: "42%" },
                minHeight: "520px",
                borderRadius: 2,
                overflow: "hidden",
                bgcolor: theme.palette.mode === "light" ? "white" : "grey.900",
                objectFit: "fill",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 2,
              }}
            >
              <Image src="/assets/images/hero-image-01.jpg" alt="Arc logo" width={700} height={720} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
            </Box>

            {/* right content */}
            <Stack spacing={2} sx={{ flex: 1 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Chip label="Opletics" color="secondary" variant="outlined" sx={{ px: 1.5, py: 0.5 }} />
              </Stack>

              <Typography variant="h4" component="h3" sx={{ lineHeight: 1.2, maxWidth: "600px", fontWeight: "700" }}>
                Schedule games without the endless back-and-forth
              </Typography>

              <Typography color="text.secondary" variant="h6" sx={{ maxWidth: "xl" }}>
                Reduce the endless back-and-forth with athletic departments and cut your scheduling time in half. Sync your spreadsheets with your calendars, send out multiple mass emails and stay
                organized with our other features.
              </Typography>
              <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
                <ButtonLink size="medium" href="/onboarding/plans" variant="outlined" endIcon={<FiArrowRight />}>
                  Get Started
                </ButtonLink>
              </Stack>

              <Stack direction="row" justifyContent="space-between" sx={{ pt: 2 }}>
                {/* progress dots */}
                <Stack direction="row" spacing={1}>
                  <Box sx={{ width: "40px", height: "8px", borderRadius: "50px", bgcolor: "primary.main" }} />
                  <Box sx={{ width: "28px", height: "8px", borderRadius: "50px", bgcolor: "grey.300" }} />
                  <Box sx={{ width: "28px", height: "8px", borderRadius: "50px", bgcolor: "grey.300" }} />
                  <Box sx={{ width: "28px", height: "8px", borderRadius: "50px", bgcolor: "grey.300" }} />
                </Stack>
              </Stack>
            </Stack>
          </Stack>
        </Box>
      </Container>

      {/* Parallax Section */}
      <Box
        sx={{
          position: "relative",
          height: { xs: "400px", md: "500px", lg: "600px" },
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Parallax Background Image */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "120%",
            transform: `translateY(${scrollY * 0.5}px)`,
            transition: "transform 0.1s ease-out",
          }}
        >
          <Image src="/assets/images/bball-court01.jpg" alt="Basketball Court" fill style={{ objectFit: "cover" }} priority />
        </Box>

        {/* Overlay */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            bgcolor: "rgba(0, 0, 0, 0.75)",
            zIndex: 1,
          }}
        />

        {/* Centered Text Content */}
        <Container
          maxWidth="md"
          sx={{
            position: "relative",
            zIndex: 2,
            textAlign: "center",
            px: { xs: 3, md: 4 },
          }}
        >
          <Typography
            variant="h3"
            component="h2"
            sx={{
              color: "white",
              fontWeight: 700,
              mb: 3,
              fontSize: { xs: "1.75rem", sm: "2.5rem", md: "3rem" },
              lineHeight: 1.2,
            }}
          >
            We believe in spending time outside, not behind a desk all day.
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: "white",
              fontSize: { xs: "1rem", sm: "1.125rem", md: "1.25rem" },
              lineHeight: 1.6,
              fontWeight: 400,
            }}
          >
            Free up space in your schedule by passing us the rock. Find dates using natural language, sync your calendar and automate processes.
          </Typography>
        </Container>
      </Box>
    </>
  );
};
