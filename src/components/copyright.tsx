import React from "react";
import { Typography } from "@mui/material";

interface CopyRightProps {
  children?: React.ReactNode;
}

const CopyRight: React.FC<CopyRightProps> = ({ children }) => {
  const defaultText = `© ${new Date().getFullYear()} Opletics Inc.. All rights reserved.`;

  return (
    <Typography variant="body2" color="text.secondary" style={{ marginTop: "5px" }} sx={{ fontSize: "0.75rem", fontWeight: 400 }}>
      {children || defaultText}
    </Typography>
  );
};

export default CopyRight;
