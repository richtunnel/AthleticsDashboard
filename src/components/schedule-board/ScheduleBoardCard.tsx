"use client";

import { useState } from "react";
import {
  Card, CardContent, CardActions, Typography,
  Avatar, Chip, Stack, Button, Box, Divider,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import LocationOnIcon    from "@mui/icons-material/LocationOn";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { sportComboLabel } from "@/lib/utils/formatGameDateTime";
import { ViewScheduleModal } from "./ViewScheduleModal";

interface Combo {
  postId:      string;
  sport:       string;
  level:       string;
  gender:      string;
  label:       string;
  seasonStart: string;
  seasonEnd:   string;
}

interface Props {
  userId:     string;
  name:       string | null;
  schoolName: string | null;
  teamName:   string | null;
  city:       string | null;
  timezone:   string;
  combos:     Combo[];
  isOwnPost:  boolean;
}

export function ScheduleBoardCard({
  userId, name, schoolName, teamName, city,
  timezone, combos, isOwnPost,
}: Props) {
  const theme           = useTheme();
  const isDark          = theme.palette.mode === "dark";
  const [open, setOpen] = useState(false);

  const displayName = schoolName || name || "Athletic Director";
  const initials    = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <Card
        elevation={0}
        sx={{
          border:       "1px solid",
          borderColor:  isOwnPost
            ? alpha(theme.palette.primary.main, 0.4)
            : "divider",
          borderRadius: 3,
          height:       "100%",
          display:      "flex",
          flexDirection: "column",
          transition:   "box-shadow 0.2s ease, border-color 0.2s ease",
          "&:hover": {
            boxShadow:   isDark
              ? "0 4px 20px rgba(0,0,0,0.4)"
              : "0 4px 20px rgba(0,0,0,0.08)",
            borderColor: alpha(theme.palette.primary.main, 0.5),
          },
        }}
      >
        <CardContent sx={{ flex: 1, p: { xs: 2, sm: 2.5 } }}>
          {/* School identity */}
          <Stack direction="row" alignItems="flex-start" gap={1.5} sx={{ mb: 2 }}>
            <Avatar
              sx={{
                width:   48,
                height:  48,
                bgcolor: "primary.main",
                fontSize: "1rem",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initials}
            </Avatar>

            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                fontWeight={700}
                lineHeight={1.2}
                sx={{ wordBreak: "break-word" }}
              >
                {displayName}
                {teamName && (
                  <Typography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 0.5 }}
                  >
                    {teamName}
                  </Typography>
                )}
              </Typography>

              {name && schoolName && (
                <Typography variant="caption" color="text.secondary" display="block">
                  {name}
                </Typography>
              )}

              {city && (
                <Stack direction="row" alignItems="center" gap={0.25} sx={{ mt: 0.25 }}>
                  <LocationOnIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                  <Typography variant="caption" color="text.secondary">
                    {city}
                  </Typography>
                </Stack>
              )}
            </Box>

            {isOwnPost && (
              <Chip
                label="Your Post"
                size="small"
                color="primary"
                variant="outlined"
                sx={{ ml: "auto", fontSize: "0.65rem", flexShrink: 0 }}
              />
            )}
          </Stack>

          <Divider sx={{ mb: 1.5 }} />

          {/* Sport combos */}
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
            <CalendarTodayIcon sx={{ fontSize: 13, color: "text.disabled" }} />
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {combos.length} sport{combos.length !== 1 ? "s" : ""} available
            </Typography>
          </Stack>

          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {combos.map((c) => (
              <Chip
                key={c.postId}
                label={sportComboLabel(c.sport, c.level, c.gender)}
                size="small"
                variant="outlined"
                sx={{ fontSize: "0.68rem" }}
              />
            ))}
          </Stack>
        </CardContent>

        <CardActions sx={{ px: { xs: 2, sm: 2.5 }, pb: 2, pt: 0 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={() => setOpen(true)}
            sx={{
              textTransform: "none",
              fontWeight:     700,
              borderRadius:   2,
            }}
          >
            View Schedule
          </Button>
        </CardActions>
      </Card>

      <ViewScheduleModal
        open={open}
        onClose={() => setOpen(false)}
        schoolName={schoolName}
        teamName={teamName}
        ownerName={name}
        city={city}
        combos={combos}
        isOwnPost={isOwnPost}
      />
    </>
  );
}
