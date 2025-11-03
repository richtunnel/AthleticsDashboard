import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { ExpenseAnalytics } from "@/components/expenses/ExpenseAnalytics";
import { Box, Divider } from "@mui/material";

export default function SportsAnalytics() {
  return (
    <Box>
      <DashboardStats />
      <Divider sx={{ my: 4 }} />
      <ExpenseAnalytics />
    </Box>
  );
}
