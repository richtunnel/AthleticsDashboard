import React from "react";
import { Box, Container, Typography, Grid, useTheme } from "@mui/material";

const DreamSection = () => {
  const theme = useTheme();

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 8 } }}>
      <Grid container spacing={0} sx={{ minHeight: { md: "70vh" } }}>
        {/* Left Column - Image (60%) */}
        <Grid
          size={{ xs: 12, md: 7.2 }} // 7.2/12 = 60%
          sx={{
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Box
            sx={{
              position: "relative",
              width: "100%",
              height: { xs: "300px", md: "500px" },
              overflow: "hidden",
              borderRadius: { xs: 2, md: 3 },
              "&::after": {
                content: '""',
                position: "absolute",
                top: 0,
                right: 0,
                width: { xs: "30%", md: "25%" },
                height: "100%",
                background: `linear-gradient(to right, transparent 0%, ${theme.palette.mode === "dark" ? theme.palette.background.default : "#ffffff"} 100%)`,
                pointerEvents: "none",
              },
            }}
          >
            <img
              src="/assets/images/ocean-court01.jpg"
              alt="Ocean Court"
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </Box>
        </Grid>

        {/* Right Column - Text Content (40%) */}
        <Grid
          size={{ xs: 12, md: 4.8 }} // 4.8/12 = 40%
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            pl: { xs: 0, md: 4 },
            pt: { xs: 4, md: 0 },
          }}
        >
          <Typography
            variant="h2"
            sx={{
              fontWeight: 700,
              mb: 3,
              fontSize: { xs: "2rem", md: "3rem", lg: "3.5rem" },
              lineHeight: 1.2,
              color: theme.palette.text.primary,
            }}
          >
            Help students <br />
            dream BIG.
          </Typography>

          <Typography
            variant="h6"
            sx={{
              color: theme.palette.text.secondary,
              lineHeight: 1.6,
              fontSize: { xs: "1rem", md: "1.125rem" },
              fontWeight: 400,
              mb: 4,
            }}
          >
            Manual day-to-day workflows take up a ton of time. Time that could be spent mentoring kids, teens and young adults or having more time to coordinate events. As experts in sports education
            and athletics we've built a tool that gets rid of the tedious task for scheduling events.
          </Typography>

          <Typography
            variant="body1"
            sx={{
              color: theme.palette.text.secondary,
              lineHeight: 1.7,
              fontSize: "1rem",
            }}
          >
            We also have a very special feature for kids that can help amplify their grit and future. Feel free to book a demo to learn more.
          </Typography>
        </Grid>
      </Grid>
    </Container>
  );
};

export default DreamSection;
