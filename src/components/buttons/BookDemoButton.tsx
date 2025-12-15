"use client";

import { Button, ButtonProps } from "@mui/material";
import DateRangeIcon from "@mui/icons-material/DateRange";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

interface BookDemoButtonProps extends Omit<ButtonProps, "onClick" | "href" | "target" | "rel"> {
  calendlyUrl?: string;
}

export default function BookDemoButton({ calendlyUrl = "https://calendly.com/opletics/30min", children = "Book a Demo", sx, ...props }: BookDemoButtonProps) {
  const handleClick = () => {
    trackEvent("Book Demo Clicked", {
      source: "book_demo_button",
      calendly_url: calendlyUrl,
    });
  };

  return (
    <Button
      variant="contained"
      component="a"
      href={calendlyUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      sx={{
        // backgroundColor: "",
        // color: "#0f172a",
        backgroundColor: "#181b38ff",
        color: "#fff",
        borderRadius: "50px",
        px: 4,
        py: 1.5,
        fontWeight: 600,
        textTransform: "none",
        fontSize: "0.85rem",
        transition: "all 0.2s ease",
        boxShadow: "none",
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
