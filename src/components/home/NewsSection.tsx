import React from "react";
import { Box, Container, Typography, Grid, Card, CardContent, Button, Chip, useTheme } from "@mui/material";
import { ArrowForward } from "@mui/icons-material";

const NewsSection = () => {
  const theme = useTheme();

  const newsItems = [
    {
      category: "COMPANY",
      title: "Opletics Receives Strategic Data from Sports Technology Partners",
      variant: "standard" as const,
    },
    {
      category: "MEDIA",
      title: '"Opletics saved our Athletics Department members valuable time using their automated workflow dashboard. "',
      variant: "standard" as const,
    },
    {
      category: "PLATFORM",
      title: "Opletics is partnering with Channl to integrating a new feature that highlights athletes productivity.",
      variant: "standard" as const,
    },
  ];

  return (
    <Box
      sx={{
        py: { xs: 6, md: 10 },
        backgroundColor: "transparent",
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={6}>
          {/* Left Column - News Items */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                mb: 6,
                fontSize: { xs: "2.5rem", md: "3.5rem" },
                lineHeight: 1.1,
                color: theme.palette.text.primary,
              }}
            >
              Shaping the Way You Schedule.
            </Typography>

            <Box sx={{ mb: 4 }}>
              {newsItems.map((item, index) => (
                <Box key={index} sx={{ mb: 4 }}>
                  <Chip
                    label={item.category}
                    size="small"
                    sx={{
                      mb: 2,
                      backgroundColor: theme.palette.primary.main,
                      color: "white",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                    }}
                  />
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 600,
                      lineHeight: 1.3,
                      color: theme.palette.text.primary,
                      fontSize: { xs: "1rem", md: "1.15rem" },
                      mb: index < newsItems.length - 1 ? 3 : 0,
                    }}
                  >
                    {item.title}
                  </Typography>
                  {index < newsItems.length - 1 && (
                    <Box
                      sx={{
                        width: "100%",
                        height: 1,
                        backgroundColor: theme.palette.divider,
                        mt: 3,
                      }}
                    />
                  )}
                </Box>
              ))}
            </Box>

            <Button
              variant="outlined"
              sx={{
                borderRadius: 3,
                px: 4,
                py: 1.5,
                fontWeight: 600,
                fontSize: "0.95rem",
                textTransform: "none",
                borderColor: theme.palette.divider,
                color: theme.palette.text.primary,
                "&:hover": {
                  borderColor: theme.palette.primary.main,
                  backgroundColor: "transparent",
                },
              }}
            >
              READ MORE
            </Button>
          </Grid>

          {/* Right Column - Featured Card */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Card
              elevation={0}
              sx={{
                height: { xs: "auto", md: "100%" },
                borderRadius: 4,
                overflow: "hidden",
                background: `linear-gradient(135deg, 
                  ${theme.palette.primary.light} 0%, 
                  ${theme.palette.primary.main} 50%,
                  ${theme.palette.secondary.main} 100%
                )`,
                color: "white",
                position: "relative",
                minHeight: { xs: 350, md: 500 },
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {/* Logo/Brand Area */}
              <Box
                sx={{
                  position: "absolute",
                  top: 32,
                  right: 32,
                  opacity: 0.3,
                }}
              >
                <Chip
                  label="COMPANY"
                  size="small"
                  sx={{
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    letterSpacing: "0.5px",
                  }}
                />
              </Box>

              {/* Large Logo */}
              <Box
                sx={{
                  position: "absolute",
                  top: "50%",
                  right: 32,
                  transform: "translateY(-50%)",
                  opacity: 0.15,
                }}
              >
                <Typography
                  variant="h1"
                  sx={{
                    fontSize: "8rem",
                    fontWeight: 700,
                    color: "white",
                    lineHeight: 1,
                  }}
                >
                  O
                </Typography>
              </Box>

              <CardContent
                sx={{
                  p: 4,
                  mt: "auto",
                  "&:last-child": { pb: 4 },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: "rgba(255, 255, 255, 0.7)",
                    fontSize: "0.875rem",
                    mb: 2,
                    display: "block",
                  }}
                >
                  October 28, 2025
                </Typography>

                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    mb: 3,
                    fontSize: { xs: "1.5rem", md: "1.75rem" },
                    lineHeight: 1.2,
                    color: "white",
                  }}
                >
                  Opletics Launches Athletic Management Public Platform
                </Typography>

                <Button
                  variant="text"
                  endIcon={<ArrowForward />}
                  sx={{
                    color: "white",
                    fontWeight: 600,
                    fontSize: "1rem",
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
                  Learn more
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default NewsSection;
