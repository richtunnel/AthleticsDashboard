"use client";

import { Button, ButtonProps } from "@mui/material";
import { useEffect } from "react";

interface BookDemoButtonProps extends Omit<ButtonProps, "onClick"> {
  calendlyUrl?: string;
}

export default function BookDemoButton({ calendlyUrl = "https://calendly.com", children = "Book a demo", sx, ...props }: BookDemoButtonProps) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      const existingScript = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  const handleClick = () => {
    if (typeof window !== "undefined" && (window as any).Calendly) {
      (window as any).Calendly.initPopupWidget({ url: calendlyUrl });
    } else {
      window.open(calendlyUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Button
      variant="contained"
      onClick={handleClick}
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
        fontSize: "1rem",
        transition: "all 0.2s ease",
        boxShadow: "0 4px 12px rgba(206, 255, 119, 0.3)",
        "&:hover": {
          backgroundColor: "#b8e660",
          transform: "translateY(-2px)",
          boxShadow: "0 6px 16px rgba(206, 255, 119, 0.4)",
        },
        "&:active": {
          transform: "translateY(0px)",
        },
        ...sx,
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
