"use client";

import { useState } from "react";
import { Card, CardContent, Typography, Button, Box, Alert } from "@mui/material";
import { DeleteForever } from "@mui/icons-material";
import DeleteAccountModal from "./DeleteAccountModal";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DeleteAccountSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDeleteAccount = async () => {
    setError(null);
    setIsDeleting(true);

    try {
      const response = await fetch("/api/user/delete-account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete account");
      }

      // Sign out and redirect to home page
      await signOut({ redirect: false });
      router.push("/?deleted=true");
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
                "&:hover": {
                  borderWidth: 2,
                }
              }}
            >
              Delete Account
            </Button>
          </Box>
        </CardContent>
      </Card>

      <DeleteAccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleDeleteAccount}
        isDeleting={isDeleting}
      />
    </>
  );
}
