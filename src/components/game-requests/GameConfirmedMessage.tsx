"use client";

import { Box, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

export function GameConfirmedMessage() {
  return (
    <Box
      sx={{
        display:        "flex",
        alignItems:     "center",
        gap:            1,
        py:             1.5,
        px:             2,
        borderRadius:   2,
        bgcolor:        "success.main",
        color:          "success.contrastText",
      }}
    >
      <CheckCircleIcon fontSize="small" />
      <Typography variant="body2" fontWeight={700}>
        Game Confirmed!
      </Typography>
    </Box>
  );
}
