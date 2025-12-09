import { Box, Container } from "@mui/material";
import React from "react";

export interface SectionProps {
  children: React.ReactNode;
  innerWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
  id?: string;
  className?: string;
  sx?: any;
}

export const Section: React.FC<SectionProps> = (props) => {
  const { children, innerWidth = "lg", ...rest } = props;

  return (
    <Box sx={{ marginTop: "50px", marginBottom: "50px" }} {...rest}>
      <Container
        maxWidth={innerWidth}
        sx={{
          height: "100%",
        }}
      >
        {children}
      </Container>
    </Box>
  );
};
