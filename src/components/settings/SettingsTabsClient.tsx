"use client";

import { useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import { Tune, AttachMoney, AutoAwesome, Group, MoreHoriz } from "@mui/icons-material";

interface SettingsTabsClientProps {
  generalContent: React.ReactNode;
  costBudgetContent: React.ReactNode;
  aiFeaturesContent: React.ReactNode;
  collaboratorContent: React.ReactNode;
  otherContent: React.ReactNode;
}

export function SettingsTabsClient({ generalContent, costBudgetContent, aiFeaturesContent, collaboratorContent, otherContent }: SettingsTabsClientProps) {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }} variant="scrollable" scrollButtons="auto">
        <Tab icon={<Tune fontSize="small" />} iconPosition="start" label="General" />
        <Tab icon={<AttachMoney fontSize="small" />} iconPosition="start" label="Cost & Budget" />
        <Tab icon={<AutoAwesome fontSize="small" />} iconPosition="start" label="AI Features" />
        <Tab icon={<Group fontSize="small" />} iconPosition="start" label="Collaborator" />
        <Tab label="Other" />
      </Tabs>

      {tab === 0 && <Box>{generalContent}</Box>}
      {tab === 1 && <Box>{costBudgetContent}</Box>}
      {tab === 2 && <Box>{aiFeaturesContent}</Box>}
      {tab === 3 && <Box>{collaboratorContent}</Box>}
      {tab === 4 && <Box>{otherContent}</Box>}
    </Box>
  );
}
