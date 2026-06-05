"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Box, CircularProgress, Tab, Tabs, Typography } from "@mui/material";
import EmailIcon    from "@mui/icons-material/Email";
import HistoryIcon  from "@mui/icons-material/History";
import { EmailGroupManager }    from "@/components/communication/email/EmailGroupManager";
import { EmailSignatureManager } from "@/components/communication/email/EmailSignatureManager";
import { EmailLogsPanel }        from "@/components/communication/email/EmailLogsPanel";
import { usePersistedTab }       from "@/hooks/usePersistedTab";

export default function EmailManagerPage() {
  const { status }     = useSession();
  const router         = useRouter();
  const searchParams   = useSearchParams();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const urlTab        = parseInt(searchParams.get("tab") ?? "", 10);
  const [tab, setTab] = usePersistedTab("email-manager-tab", 1, isNaN(urlTab) ? undefined : urlTab);

  if (status === "loading") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <Box sx={{ maxWidth: 1440, mx: "auto", py: 2 }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
        Email Manager
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v: number) => setTab(v)}
        sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab icon={<EmailIcon fontSize="small" />}   iconPosition="start" label="Email Groups" />
        <Tab icon={<HistoryIcon fontSize="small" />} iconPosition="start" label="Email Logs" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <EmailGroupManager />
          <EmailSignatureManager />
        </Box>
      )}

      {tab === 1 && <EmailLogsPanel />}
    </Box>
  );
}
