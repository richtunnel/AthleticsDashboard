"use client";

import { useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import { Tune, AttachMoney, AutoAwesome, Group, MoreHoriz, Inbox } from "@mui/icons-material";
import { TipBubble } from "@/components/tips/TipBubble";
import { TIP_IDS } from "@/components/tips/tipIds";
import { GameRequestUnreadBadge } from "@/components/game-requests/GameRequestUnreadBadge";

interface SettingsTabsClientProps {
  generalContent:      React.ReactNode;
  costBudgetContent:   React.ReactNode;
  aiFeaturesContent:   React.ReactNode;
  collaboratorContent: React.ReactNode;
  otherContent:        React.ReactNode;
  gameRequestsContent: React.ReactNode;
}

export function SettingsTabsClient({
  generalContent,
  costBudgetContent,
  aiFeaturesContent,
  collaboratorContent,
  otherContent,
  gameRequestsContent,
}: SettingsTabsClientProps) {
  const [tab, setTab] = useState(0);
  const [otherTabEl, setOtherTabEl] = useState<HTMLElement | null>(null);

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }} variant="scrollable" scrollButtons="auto">
        <Tab icon={<Tune fontSize="small" />} iconPosition="start" label="General" />
        <Tab icon={<AttachMoney fontSize="small" />} iconPosition="start" label="Cost & Budget" />
        <Tab icon={<AutoAwesome fontSize="small" />} iconPosition="start" label="AI Features" />
        <Tab icon={<Group fontSize="small" />} iconPosition="start" label="Collaborator" />
        <Tab
          iconPosition="start"
          icon={
            <GameRequestUnreadBadge>
              <Inbox fontSize="small" />
            </GameRequestUnreadBadge>
          }
          label="Game Requests"
        />
        <Tab ref={setOtherTabEl} label="Other" />
      </Tabs>

      <TipBubble
        tipId={TIP_IDS.SETTINGS_OTHER}
        anchorEl={tab === 5 ? otherTabEl : null}
        placement="bottom-end"
        title="Customize your workspace"
        body="Enable the Score Tracker to log game results and team stats, hide menu items you don't use to keep your sidebar clean, and reset your spreadsheet columns to defaults."
      />

      {tab === 0 && <Box>{generalContent}</Box>}
      {tab === 1 && <Box>{costBudgetContent}</Box>}
      {tab === 2 && <Box>{aiFeaturesContent}</Box>}
      {tab === 3 && <Box>{collaboratorContent}</Box>}
      {tab === 4 && <Box>{gameRequestsContent}</Box>}
      {tab === 5 && <Box>{otherContent}</Box>}
    </Box>
  );
}
