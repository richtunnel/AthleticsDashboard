import { Features } from "./features";
import { FiArrowRight, FiBox, FiCheck, FiCode, FiCopy, FiFlag, FiGrid, FiLock, FiSearch, FiSliders, FiSmile, FiTerminal, FiThumbsUp, FiToggleLeft, FiTrendingUp, FiUserPlus } from "react-icons/fi";
import { Box, ButtonGroup, Chip, Container, IconButton, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { CalendarMonth, EmailRounded, BorderAll, ScoreboardRounded, AutoAwesomeRounded } from "@mui/icons-material";

export const FeaturesSection = () => {
  return (
    <Features
      id="features"
      title={
        <Typography
          variant="h3"
          sx={{
            lineHeight: "short",
            fontSize: { xs: "2xl", lg: "4xl" },
            textAlign: "left",
            fontWeight: "700",
          }}
        >
          Made for Directors,
          <br /> Coaches and Staff.
        </Typography>
      }
      description={
        <>
          Opletics includes a ton of useful features for sports coordinators.
          <br />
          We've helped athletic directors shave off over 60% of their daily workflow.
        </>
      }
      align="left"
      columns={{ xs: 1, sm: 2, md: 3 }}
      iconSize={32}
      features={[
        {
          title: "Calander Sync.",
          icon: CalendarMonth,
          description: "Automatically sync your game schedules to your calendar, no more manual typing. ",
          variant: "inline",
        },
        {
          title: "Bulk Email",
          icon: EmailRounded,
          description: "Quickly email your game schedules using our advanced campaign manager and email tracking.",
          variant: "inline",
        },
        {
          title: "Find Dates.",
          icon: FiSearch,
          description: "No more searching for open dates, use our date finder to find game date availability.",
          variant: "inline",
        },
        {
          title: "Spreadsheet",
          icon: BorderAll,
          description: "After importing your game schedule spreadsheet use our digital spreadsheet to filter, search, sort, reorder and edit your data.",
          variant: "inline",
        },
        {
          title: "Score Tracker",
          icon: ScoreboardRounded,
          description: "We have a unique place for you to keep track of your teams wins and losses.",
          variant: "inline",
        },
        {
          title: "AI",
          icon: AutoAwesomeRounded,
          description: "We have artificial features that help you find traveling times, email generation and schedule confiliction.",
          variant: "inline",
        },
      ]}
    />
  );
};
