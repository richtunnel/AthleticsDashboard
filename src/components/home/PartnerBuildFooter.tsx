import React from "react";
import { Box, Container, Typography, Grid, Card, CardContent, Button, useTheme } from "@mui/material";
import { ArrowForward } from "@mui/icons-material";

const PartnerBuildSectionFooter = () => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        py: { xs: 6, md: 10 },
        backgroundColor: "transparent",
      }}
    >
      <Container maxWidth="lg" style={{ padding: "0px", margin: "0" }}>
        {/* Title */}
        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            fontSize: { xs: "2rem", md: "2.5rem" },
            lineHeight: 1.1,
            color: "#fff",
            textAlign: "left",
            maxWidth: 800,
            margin: "50px 0px",
          }}
        >
          Schedule Smarter
        </Typography>

        {/* Cards Grid */}
        <Grid container spacing={3} sx={{ maxWidth: 900 }}>
          {/* Partner Card */}
          <Grid size={{ xs: 12, md: 6 }} sx={{ margin: "0", paddding: "0" }}>
            <Card
              elevation={0}
              sx={{
                height: "100%",
                borderRadius: 4,
                p: 4,
                backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100],
                border: `1px solid ${theme.palette.divider}`,
                transition: "all 0.3s ease",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: theme.shadows[8],
                },
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 300,
              }}
            >
              <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    mb: 3,
                    fontSize: { xs: "1.25rem", md: "1.5rem" },
                    color: theme.palette.text.primary,
                  }}
                >
                  Partner with Opletics
                </Typography>

                <Typography
                  variant="body1"
                  sx={{
                    color: theme.palette.text.secondary,
                    lineHeight: 1.6,
                    fontSize: "1.1rem",
                    mb: 4,
                  }}
                >
                  Join the Opletics network to unlock access to our comprehensive ecosystem of athletic management tools and integrations.
                </Typography>
              </CardContent>

              <Button
                variant="text"
                endIcon={<ArrowForward />}
                sx={{
                  alignSelf: "flex-start",
                  fontWeight: 600,
                  fontSize: "1rem",
                  color: theme.palette.text.primary,
                  p: 0,
                  "&:hover": {
                    backgroundColor: "transparent",
                    "& .MuiSvgIcon-root": {
                      transform: "translateX(4px)",
                    },
                  },
                  "& .MuiSvgIcon-root": {
                    transition: "transform 0.2s ease",
                  },
                }}
              >
                Get started
              </Button>
            </Card>
          </Grid>

          {/* Build Card */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              elevation={0}
              sx={{
                height: "100%",
                borderRadius: 4,
                p: 4,
                backgroundColor: theme.palette.mode === "dark" ? "#1a1a2e" : "#2c2c54",
                color: "white",
                transition: "all 0.3s ease",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: theme.shadows[12],
                },
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 300,
              }}
            >
              <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    mb: 3,
                    fontSize: { xs: "1.25rem", md: "1.5rem" },
                    color: "white",
                  }}
                >
                  Build with Opletics
                </Typography>

                <Typography
                  variant="body1"
                  sx={{
                    color: "rgba(255, 255, 255, 0.8)",
                    lineHeight: 1.6,
                    fontSize: "1.1rem",
                    mb: 4,
                  }}
                >
                  Explore our Developer Console to see how you can integrate Opletics solutions for your athletic department.
                </Typography>
              </CardContent>

              <Button
                variant="text"
                endIcon={<ArrowForward />}
                sx={{
                  alignSelf: "flex-start",
                  fontWeight: 600,
                  fontSize: "1rem",
                  color: "white",
                  p: 0,
                  "&:hover": {
                    backgroundColor: "transparent",
                    "& .MuiSvgIcon-root": {
                      transform: "translateX(4px)",
                    },
                  },
                  "& .MuiSvgIcon-root": {
                    transition: "transform 0.2s ease",
                  },
                }}
              >
                Start building
              </Button>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default PartnerBuildSectionFooter;
