"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, CircularProgress, Alert, Stack } from "@mui/material";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import { importGoogleEmailGroups } from "@/app/actions/googleGroups";
import { useState } from "react";

export function ImportGroupsButton() {
  const queryClient = useQueryClient();
  const [lastError, setLastError] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: importGoogleEmailGroups,
    onSuccess: (result) => {
      setLastError(null); // Clear any previous error
      if (result.success) {
        // Invalidate the query that fetches email groups to refresh the list
        queryClient.invalidateQueries({ queryKey: ["email-groups"] });
        // Optionally, you might have a query for all user data/settings
        queryClient.invalidateQueries({ queryKey: ["user-data"] });
      } else {
        // Handle a successful API call that returned a business-level error
        setLastError(result.error || "Import failed due to an internal error.");
      }
    },
    onError: (error: any) => {
      // Handle network or system errors (e.g., failed token refresh)
      setLastError(error.message || "Network error occurred during import.");
    },
  });

  return (
    <Stack spacing={1} direction="column" alignItems="flex-start">
      <Button
        variant="contained"
        startIcon={importMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <CloudDownloadIcon />}
        onClick={() => importMutation.mutate()}
        disabled={importMutation.isPending}
      >
        {importMutation.isPending ? "Importing Groups..." : "Import Google Groups"}
      </Button>

      {/* Show Success Message */}
      {importMutation.isSuccess && !lastError && (
        <Alert severity="success" sx={{ width: "100%" }}>
          {importMutation.data?.message || "Email groups imported successfully."}
        </Alert>
      )}

      {/* Show Error Message */}
      {lastError && (
        <Alert severity="error" onClose={() => setLastError(null)} sx={{ width: "100%" }}>
          Import Error: {lastError}
        </Alert>
      )}
    </Stack>
  );
}
