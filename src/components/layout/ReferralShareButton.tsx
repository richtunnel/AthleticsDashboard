"use client";

import { useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { Share } from "@mui/icons-material";
import ReferralShareDialog from "@/components/referrals/ReferralShareDialog";

export default function ReferralShareButton() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleOpen = () => {
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
  };

  return (
    <>
      <Tooltip title="Refer a Friend">
        <IconButton onClick={handleOpen} sx={{ mr: 1 }} color="default" aria-label="Refer a friend">
          <Share />
        </IconButton>
      </Tooltip>

      <ReferralShareDialog open={dialogOpen} onClose={handleClose} />
    </>
  );
}
