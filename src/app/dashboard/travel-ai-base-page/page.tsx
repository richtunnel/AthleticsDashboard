import { Card, CardContent, Typography, Box } from "@mui/material";
import AIButton from "@/components/buttons/EnableAiButton";

const plans = [
  {
    name: "Directors plan",
    monthlyPrice: 40,
    annualPrice: 250,
    mostPopular: true,
    features: ["Everything in Free plan plus...", "50,000+ batch email sends", "Advanced reporting and analytics", "Up to 20 individual users", "Priority chat and email support"],
  },
  // {
  //   name: "Enterprise plan",
  //   monthlyPrice: 64,
  //   annualPrice: 52,
  //   features: ["Everything in Business plus...", "200+ integrations", "Advanced reporting and analytics", "Unlimited individual users", "Unlimited individual data", "Personalized + priority service"],
  // },
];

const handleSelectPlan = (e: any) => {
  e.preventDefault();
};

export default async function TravelAi() {
  return (
    <>
      <Box sx={{ p: 3 }}>
        <Typography sx={{ mb: 1 }} variant="h5">
          Bus Travel AI
        </Typography>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recommended Travel Times
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              We recommend the best travel times based on weather, traffic patterns, date and time.
            </Typography>
            {/* <ConnectCalendarButton isConnected={isCalendarConnected} /> */}
            <AIButton />
          </CardContent>
        </Card>
      </Box>
    </>
  );
}
