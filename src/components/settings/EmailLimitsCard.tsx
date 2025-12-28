"use client";

import { Card, CardContent, Typography, Box, LinearProgress, Tooltip, IconButton } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useTheme } from "@mui/material/styles";

interface EmailLimitsData {
  daily: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  monthly: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
}

export function EmailLimitsCard() {
  const theme = useTheme();
  const { data, isLoading, error } = useQuery<{ data: EmailLimitsData }>({
    queryKey: ["emailLimits"],
    queryFn: async () => {
      const response = await fetch("/api/email/limits");
      if (!response.ok) {
        throw new Error("Failed to fetch email limits");
      }
      return response.json();
    },
    refetchInterval: 60000, // Refetch every minute
  });

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "error";
    if (percentage >= 75) return "warning";
    return "primary";
  };

  if (error) {
    return null; // Silently fail if there's an error
  }

  return (
    <Card sx={{ mb: 3, boxShadow: "none!important" }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Typography variant="h6" sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
            Email Usage
          </Typography>
          <Tooltip title="Track your email sending limits. Each user can send up to 75 emails per day, and the system has a monthly limit of 100,000 emails." arrow>
            <IconButton size="small">
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
          Monitor your email sending quota to ensure uninterrupted service.
        </Typography>

        {isLoading ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Daily Limit
              </Typography>
              <LinearProgress sx={{ backgroundColor: theme.palette.mode === "dark" ? theme.palette.themeText.text : "" }} />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Monthly Limit (System-wide)
              </Typography>
              <LinearProgress sx={{ backgroundColor: theme.palette.mode === "dark" ? theme.palette.themeText.text : "" }} />
            </Box>
          </Box>
        ) : data?.data ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Daily Limit */}
            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  Daily Limit (Your Account)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {data.data.daily.used.toLocaleString()} / {data.data.daily.limit.toLocaleString()}
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={Math.min(data.data.daily.percentage, 100)} color={getProgressColor(data.data.daily.percentage)} sx={{ height: 8, borderRadius: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                {data.data.daily.remaining > 0
                  ? `${data.data.daily.remaining} email${data.data.daily.remaining === 1 ? "" : "s"} remaining today`
                  : "Daily limit reached. Resets in 24 hours from your first email today."}
              </Typography>
            </Box>

            {/* Monthly Limit */}
            {/* <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  Monthly Limit (System-wide)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {data.data.monthly.used.toLocaleString()} / {data.data.monthly.limit.toLocaleString()}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(data.data.monthly.percentage, 100)}
                color={getProgressColor(data.data.monthly.percentage)}
                sx={{ height: 8, borderRadius: 1 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                {data.data.monthly.remaining > 0 
                  ? `${data.data.monthly.remaining.toLocaleString()} email${data.data.monthly.remaining === 1 ? '' : 's'} remaining this month`
                  : "Monthly limit reached. Resets at the start of next month."}
              </Typography>
            </Box> */}
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}
