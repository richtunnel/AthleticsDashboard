import { alpha, type Components, type Theme } from "@mui/material/styles";

export const buildThemeComponents = (theme: Theme): Components<Theme> => {
  const primaryMain = theme.palette.primary.main;
  const paperBorderColor = alpha("#0F172A", 0.06);
  const cardShadow = "0 20px 45px rgba(15, 23, 42, 0.12)";
  const hoverOverlay = alpha(primaryMain, 0.08);

  return {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundImage: "none",
          // boxShadow: "0 1px 0 rgba(15, 23, 42, 0.06)",
          backdropFilter: "blur(12px)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderRadius: 16,
          border: `1px solid ${paperBorderColor}`,
          boxShadow: cardShadow,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: `1px solid ${paperBorderColor}`,
          backgroundColor: theme.palette.background.paper,
          boxShadow: cardShadow,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#FFFFFF",
          borderRight: `1px solid ${theme.palette.divider}`,
          backdropFilter: "blur(18px)",
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingBlock: theme.spacing(1),
          paddingInline: theme.spacing(2),
          color: theme.palette.text.secondary,
          transition: "all 0.2s ease",
          "&:hover": {
            backgroundColor: hoverOverlay,
            color: theme.palette.text.primary,
          },
          "&.Mui-selected": {
            backgroundColor: alpha(primaryMain, 0.16),
            color: theme.palette.primary.dark,
            "&:hover": {
              backgroundColor: alpha(primaryMain, 0.22),
            },
            "& .MuiListItemIcon-root": {
              color: theme.palette.primary.dark,
            },
          },
          "& .MuiListItemIcon-root": {
            minWidth: 40,
            color: theme.palette.text.secondary,
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          color: theme.palette.text.secondary,
          minWidth: 40,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: "none",
          fontWeight: 600,
          letterSpacing: 0.2,
        },
        contained: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: `0 12px 20px ${alpha(primaryMain, 0.22)}`,
          },
        },
        outlined: {
          borderWidth: 1.5,
          borderColor: alpha(primaryMain, 0.4),
          "&:hover": {
            borderColor: primaryMain,
            backgroundColor: alpha(primaryMain, 0.12),
          },
        },
        text: {
          "&:hover": {
            backgroundColor: hoverOverlay,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          color: theme.palette.text.secondary,
          transition: "all 0.2s ease",
          "&:hover": {
            backgroundColor: hoverOverlay,
            color: theme.palette.text.primary,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
        filled: {
          backgroundColor: alpha(primaryMain, 0.12),
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
          border: `1px solid ${theme.palette.divider}`,
          backgroundImage: "none",
          backgroundColor: theme.palette.background.paper,
          boxShadow: cardShadow,
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
          border: `1px solid ${theme.palette.divider}`,
          backgroundImage: "none",
          backgroundColor: theme.palette.background.paper,
          boxShadow: cardShadow,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${alpha(theme.palette.divider, 1)}`,
          "&.MuiTableCell-head": {
            fontWeight: 600,
            textTransform: "uppercase",
            fontSize: "0.75rem",
            letterSpacing: 0.5,
            color: theme.palette.text.secondary,
            backgroundColor: alpha(primaryMain, 0.05),
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 8,
          borderRadius: 999,
        },
        bar: {
          borderRadius: 999,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: "#FFFFFF",
          "& input": {
            fontSize: "0.95rem",
          },
          "& fieldset": {
            borderColor: alpha(theme.palette.text.secondary, 0.18),
          },
          "&:hover fieldset": {
            borderColor: alpha(primaryMain, 0.6),
          },
          "&.Mui-focused fieldset": {
            borderColor: primaryMain,
            borderWidth: 1.5,
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 18,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          boxShadow: cardShadow,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          padding: theme.spacing(1, 1.5),
          fontSize: "0.75rem",
          backgroundColor: alpha("#0F172A", 0.92),
        },
        arrow: {
          color: alpha("#0F172A", 0.92),
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: alpha(theme.palette.divider, 1),
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          border: `1px solid ${theme.palette.background.paper}`,
          padding: "0 4px",
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          "&.Mui-checked": {
            color: theme.palette.primary.main,
            "& + .MuiSwitch-track": {
              backgroundColor: alpha(primaryMain, 0.5),
            },
          },
        },
        track: {
          borderRadius: 999,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 42,
        },
        indicator: {
          height: 3,
          borderRadius: 999,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          minHeight: 42,
          fontWeight: 500,
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(primaryMain, 0.14),
          color: theme.palette.primary.dark,
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: theme.palette.background.default,
          color: theme.palette.text.primary,
        },
        "*": {
          transition: "background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease",
        },
        "*::-webkit-scrollbar": {
          width: "8px",
          height: "8px",
        },
        "*::-webkit-scrollbar-thumb": {
          backgroundColor: alpha(primaryMain, 0.18),
          borderRadius: 999,
        },
      },
    },
  };
};
