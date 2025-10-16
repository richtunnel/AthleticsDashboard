import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { Card, CardContent, Typography, Box } from "@mui/material";
import { ConnectCalendarButton } from "@/components/calendar/ConnectCalendarButton";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      googleCalendarRefreshToken: true,
      calendarTokenExpiry: true,
    },
  });

  const isCalendarConnected = !!user?.googleCalendarRefreshToken;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Google Calendar Integration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Connect your Google Calendar to automatically sync games and events.
          </Typography>
          <ConnectCalendarButton isConnected={isCalendarConnected} />
        </CardContent>
      </Card>
    </Box>
  );
}
