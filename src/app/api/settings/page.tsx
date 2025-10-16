import { ConnectCalendarButton } from "@/components/calendar/ConnectCalendarButton";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { Alert, Card, CardContent, Typography } from "@mui/material";
import { CheckCircle } from "@mui/icons-material";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  const user = session?.user
    ? await prisma.user.findUnique({
        where: { email: session.user.email! },
        select: {
          googleCalendarRefreshToken: true,
          calendarTokenExpiry: true,
        },
      })
    : null;

  const isCalendarConnected = !!user?.googleCalendarRefreshToken;

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Google Calendar Integration
          </Typography>

          {isCalendarConnected ? (
            <Alert severity="success" icon={<CheckCircle />}>
              Your Google Calendar is connected and ready to sync events.
            </Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Connect your Google Calendar to automatically sync games and events.
              </Typography>
              <ConnectCalendarButton />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
