import { Stack, Typography, Box } from "@mui/material";
import React from "react";

export interface SectionTitleProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  variant?: string;
  spacing?: number;
  sx?: any;
  id?: string;
  className?: string;
}

export const SectionTitle: React.FC<SectionTitleProps> = (props) => {
  const { title, description, align = "center", variant, spacing = 2, ...rest } = props;

  return (
    <Stack direction="column" alignItems={align === "left" ? "flex-start" : "center"} spacing={spacing} {...rest}>
      <Typography style={{ marginBottom: "10px" }} variant="h4" component="h2">
        {title}
      </Typography>
      {description && <Box sx={{ textAlign: align }}>{description}</Box>}
    </Stack>
  );
};
