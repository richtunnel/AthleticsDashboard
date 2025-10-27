"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Box, CircularProgress } from "@mui/material";
import { EmailGroupManager } from "@/components/communication/email/EmailGroupManager";

export default function EmailGroupsPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <Box sx={{ maxWidth: 1024, mx: "auto", py: 4 }}>
      <EmailGroupManager />
    </Box>
  );
}
