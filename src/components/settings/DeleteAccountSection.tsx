"use client";

import { useState } from "react";
import { Card, CardContent, Typography, Button, Box, Alert } from "@mui/material";
import { DeleteForever } from "@mui/icons-material";
import DeleteAccountModal from "./DeleteAccountModal";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTheme } from "@mui/material/styles";

interface DeleteAccountSectionProps {
  /** API endpoint for the DELETE request. Defaults to "/api/user/delete-account". */
  apiEndpoint?: string;
  /** Path to redirect to after successful deletion. Defaults to "/?deleted=true". */
  redirectPath?: string;
  /** Optional custom sign-out function. Defaults to next-auth signOut. */
  onSignOut?: () => Promise<void>;
}

export default function DeleteAccountSection({
  apiEndpoint = "/api/user/delete-account",
  redirectPath = "/?deleted=true",
  onSignOut,
}: DeleteAccountSectionProps = {}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const theme = useTheme();

  const handleDeleteAccount = async () => {
    setError(null);
    setIsDeleting(true);

    try {
      const response = await fetch(apiEndpoint, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete account");
      }

      // Sign out and redirect
      if (onSignOut) {
        await onSignOut();
      } else {
        await signOut({ redirect: false });
      }
      router.push(redirectPath);
    } catch (err: any) {
      console.error("Error deleting account:", err);
      setError(err.message || "An error occurred while deleting your account");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card sx={{ mb: 3, boxShadow: "none!important", border: "1px solid", borderColor: "error.main" }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" }, color: "error.main" }}>
            Danger Zone
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
            Once you delete your account, there is no going back. Please be certain.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteForever />}
              onClick={() => setModalOpen(true)}
              sx={{
                fontWeight: 600,
                borderWidth: 2,
                borderColor: theme.palette.mode === "dark" ? theme.palette.themeText.text : "",
                "&:hover": {
                  borderWidth: 2,
                },
              }}
            >
              Delete Account
            </Button>
          </Box>
        </CardContent>
      </Card>

      <DeleteAccountModal open={modalOpen} onClose={() => setModalOpen(false)} onConfirm={handleDeleteAccount} isDeleting={isDeleting} />
    </>
  );
}
