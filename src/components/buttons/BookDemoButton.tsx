"use client";

import { Button, ButtonProps } from "@mui/material";
import DateRangeIcon from "@mui/icons-material/DateRange";

interface BookDemoButtonProps extends Omit<ButtonProps, "onClick" | "href" | "target" | "rel"> {
  calendlyUrl?: string;
}

export default function BookDemoButton({ calendlyUrl = "https://calendly.com/athleticdirectorhub/30min", children = "Schedule Live Demo", sx, ...props }: BookDemoButtonProps) {
  return (
    <Button
      variant="contained"
      component="a"
      href={calendlyUrl}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        // backgroundColor: "",
        // color: "#0f172a",
        backgroundColor: "#0f172a",
        color: "#ceff77",
        borderRadius: "50px",
        px: 4,
        py: 1.5,
        fontWeight: 600,
        textTransform: "none",
        fontSize: "0.85rem",
        transition: "all 0.2s ease",
        boxShadow: "0 4px 12px rgba(206, 255, 119, 0.3)",
        "&:hover": {
          backgroundColor: "#b8e660",
          color: "#000",
          transform: "translateY(-2px)",
          boxShadow: "0 6px 16px rgba(206, 255, 119, 0.1)",
        },
        "&:active": {
          transform: "translateY(0px)",
        },
        ...sx,
      }}
      {...props}
    >
      {children}&nbsp;&nbsp;
      <DateRangeIcon />
    </Button>
  );
}
