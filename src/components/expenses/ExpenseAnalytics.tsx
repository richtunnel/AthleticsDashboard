"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  CircularProgress,
} from "@mui/material";
import { Download, DollarSign, TrendingUp, Calendar } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ExpenseAnalytics as ExpenseAnalyticsType } from "../../../types/expenses";

export function ExpenseAnalytics() {
  const { data, isLoading, error } = useQuery<{ data: ExpenseAnalyticsType }>({
    queryKey: ["expense-analytics"],
    queryFn: async () => {
      const res = await fetch("/api/expenses/analytics");
      if (!res.ok) throw new Error("Failed to fetch expense analytics");
      return res.json();
    },
  });

  const handleExport = async () => {
    try {
      const response = await fetch("/api/export/expenses");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `expenses_export_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting expenses:", error);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">Failed to load expense analytics</Typography>
      </Box>
    );
  }

  const analytics = data?.data;

  if (!analytics || analytics.totals.gameCount === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" color="text.secondary">
          No expense data available yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Start tracking expenses for your games to see analytics here
        </Typography>
      </Box>
    );
  }

  const stats = [
    {
      name: "Total Expenses",
      value: `$${analytics.totals.totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "primary",
    },
    {
      name: "Average Per Game",
      value: `$${analytics.averagePerGame.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: "success",
    },
    {
      name: "Games Tracked",
      value: analytics.totals.gameCount,
      icon: Calendar,
      color: "info",
    },
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" component="h2">
          Expense Analytics
        </Typography>
        <Button
          variant="contained"
          startIcon={<Download />}
          onClick={handleExport}
          disabled={analytics.totals.gameCount === 0}
        >
          Export Data
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Grid size={{ xs: 12, sm: 4 }} key={stat.name}>
              <Card>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <Box
                      sx={{
                        bgcolor: `${stat.color}.main`,
                        color: "white",
                        p: 1.5,
                        borderRadius: 1,
                        mr: 2,
                      }}
                    >
                      <Icon size={24} />
                    </Box>
                    <Box>
                      <Typography variant="h5" component="div">
                        {stat.value}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {stat.name}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Monthly Expense Breakdown
              </Typography>
              <Box sx={{ width: "100%", height: 400, mt: 2 }}>
                <ResponsiveContainer>
                  <BarChart data={analytics.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) =>
                        `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      }
                    />
                    <Legend />
                    <Bar dataKey="travelExpense" stackId="a" fill="#8884d8" name="Travel" />
                    <Bar dataKey="foodExpense" stackId="a" fill="#82ca9d" name="Food" />
                    <Bar dataKey="clothesExpense" stackId="a" fill="#ffc658" name="Clothes" />
                    <Bar dataKey="giftsExpense" stackId="a" fill="#ff8042" name="Gifts" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Expenses Over Time
              </Typography>
              <Box sx={{ width: "100%", height: 400, mt: 2 }}>
                <ResponsiveContainer>
                  <LineChart data={analytics.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) =>
                        `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="totalExpense"
                      stroke="#8884d8"
                      strokeWidth={2}
                      name="Total Expense"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Expense Category Totals
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box sx={{ p: 2, bgcolor: "rgba(136, 132, 216, 0.1)", borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Travel
                    </Typography>
                    <Typography variant="h6">
                      ${analytics.totals.travelExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box sx={{ p: 2, bgcolor: "rgba(130, 202, 157, 0.1)", borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Food
                    </Typography>
                    <Typography variant="h6">
                      ${analytics.totals.foodExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box sx={{ p: 2, bgcolor: "rgba(255, 198, 88, 0.1)", borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Clothes
                    </Typography>
                    <Typography variant="h6">
                      ${analytics.totals.clothesExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box sx={{ p: 2, bgcolor: "rgba(255, 128, 66, 0.1)", borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Gifts
                    </Typography>
                    <Typography variant="h6">
                      ${analytics.totals.giftsExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
