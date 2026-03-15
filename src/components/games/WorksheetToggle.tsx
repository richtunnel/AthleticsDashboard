"use client";

import { Box, Typography } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import styles from "@/styles/worksheet.module.css";

interface WorksheetToggleProps {
  activeTab: "worksheet" | "view";
  worksheetName: string;
  onTabChange: (tab: "worksheet" | "view") => void;
}

export function WorksheetToggle({ activeTab, worksheetName, onTabChange }: WorksheetToggleProps) {
  const theme = useTheme();

  const pillBg = theme.palette.mode === "dark" ? alpha(theme.palette.common.white, 0.08) : alpha(theme.palette.common.black, 0.06);

  const activeBg = theme.palette.mode === "dark" ? alpha(theme.palette.common.white, 0.15) : theme.palette.common.white;

  const activeColor = theme.palette.mode === "dark" ? theme.palette.common.white : theme.palette.text.primary;

  const inactiveColor = theme.palette.mode === "dark" ? alpha(theme.palette.common.white, 0.5) : theme.palette.text.secondary;

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        mb: 0,
      }}
    >
      <Box
        className={styles.WorkSheetPillBox}
        sx={{
          display: "inline-flex",
          bgcolor: pillBg,
          borderRadius: "999px",
          p: "3px",
          gap: "2px",
        }}
      >
        {/* Worksheet name tab */}
        <Box
          onClick={() => onTabChange("worksheet")}
          sx={{
            px: 2.5,
            py: 0.75,
            borderRadius: "999px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            bgcolor: activeTab === "worksheet" ? activeBg : "transparent",
            boxShadow: activeTab === "worksheet" ? (theme.palette.mode === "dark" ? "none" : "0 1px 3px rgba(0,0,0,0.1)") : "none",
            "&:hover": {
              bgcolor: activeTab === "worksheet" ? activeBg : alpha(theme.palette.common.white, 0.05),
            },
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: activeTab === "worksheet" ? 600 : 400,
              color: activeTab === "worksheet" ? activeColor : inactiveColor,
              fontSize: "0.8rem",
              userSelect: "none",
              maxWidth: 180,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {worksheetName || "View"}
          </Typography>
        </Box>

        {/* View tab */}
        <Box
          onClick={() => onTabChange("view")}
          sx={{
            px: 2.5,
            py: 0.75,
            borderRadius: "999px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            bgcolor: activeTab === "view" ? activeBg : "transparent",
            boxShadow: activeTab === "view" ? (theme.palette.mode === "dark" ? "none" : "0 1px 3px rgba(0,0,0,0.1)") : "none",
            "&:hover": {
              bgcolor: activeTab === "view" ? activeBg : alpha(theme.palette.common.white, 0.05),
            },
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: activeTab === "view" ? 600 : 400,
              color: activeTab === "view" ? activeColor : inactiveColor,
              fontSize: "0.8rem",
              userSelect: "none",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            Worksheets
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
