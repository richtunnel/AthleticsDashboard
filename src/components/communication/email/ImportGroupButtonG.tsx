"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, CircularProgress, Collapse, Stack } from "@mui/material";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";

import { importGoogleEmailGroups } from "@/app/actions/googleGroups";
import { useTheme } from "@/contexts/ThemeContext";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

export function ImportGroupsButton() {
  const queryClient = useQueryClient();
  const [lastError, setLastError] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasAutoImportedRef = useRef(false);
  const { mode } = useTheme();

  const importMutation = useMutation({
    mutationFn: (payload: { returnTo?: string }) => importGoogleEmailGroups(payload),
    onSuccess: (result) => {
      if (result.requiresAuth && result.authUrl) {
        window.location.assign(result.authUrl);
        return;
      }

      setLastError(null);

      // Refresh the Email Manager list whenever the action actually wrote
      // something. "no_groups" / "no_contacts" are success outcomes that
      // didn't touch the DB — no need to refetch.
      if (result.success && result.status === "imported") {
        queryClient.invalidateQueries({ queryKey: ["email-groups"], refetchType: "all" });
        queryClient.invalidateQueries({ queryKey: ["user-data"] });
      }

      if (!result.success) {
        setLastError(result.error || "Import failed due to an internal error.");
      }
    },
    onError: (error: any) => {
      setLastError(error.message || "Network error occurred during import.");
    },
  });

  const buildReturnTo = useCallback(
    (includeAutoImportFlag: boolean) => {
      const params = new URLSearchParams(searchParams.toString());

      if (includeAutoImportFlag) {
        params.set("autoImportGoogleGroups", "1");
      } else {
        params.delete("autoImportGoogleGroups");
      }

      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams]
  );

  useEffect(() => {
    const shouldAutoImport = searchParams.get("autoImportGoogleGroups") === "1";

    if (!shouldAutoImport || hasAutoImportedRef.current) {
      return;
    }

    hasAutoImportedRef.current = true;

    const returnToWithAutoImport = buildReturnTo(true);
    const cleanUrl = buildReturnTo(false);
    router.replace(cleanUrl);

    importMutation.mutate({ returnTo: returnToWithAutoImport });
  }, [searchParams, buildReturnTo, router, importMutation]);

  // Pick which Alert to show based on the discriminator the server returned.
  // The OAuth-redirect path navigates away — we never render its "success".
  const result = importMutation.data;
  const status = result?.status;
  const isInfoStatus = status === "no_groups" || status === "no_contacts";
  const isSuccessStatus = status === "imported";
  const showError = !!lastError;

  return (
    <Stack spacing={1} direction="column" alignItems="flex-start" sx={{ width: "100%" }}>
      {/* Status slot — fixed above the button. Reserves vertical space so the
          button itself never shifts when a message appears/disappears. */}
      <Box sx={{ width: "100%" }}>
        {/* ✓ Imported N contacts into "Google Contact" group */}
        <Collapse in={isSuccessStatus && !showError} unmountOnExit>
          <Alert severity="success" sx={{ width: "100%" }}>
            {result?.message || "Email groups imported successfully."}
          </Alert>
        </Collapse>

        {/* ℹ No contact groups / no contacts found — distinct from failure. */}
        <Collapse in={isInfoStatus && !showError} unmountOnExit>
          <Alert severity="info" sx={{ width: "100%" }}>
            {result?.message ||
              "Nothing to import from your Google contact groups."}
          </Alert>
        </Collapse>

        {/* ✗ Import failed */}
        <Collapse in={showError} unmountOnExit>
          <Alert severity="error" onClose={() => setLastError(null)} sx={{ width: "100%" }}>
            Import failed: {lastError}
          </Alert>
        </Collapse>
      </Box>

      <Button
        variant="contained"
        startIcon={importMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <CloudDownloadIcon />}
        onClick={() => {
          trackEvent("Import Google Contacts Clicked", {
            source: "email_manager",
            action: "import_google_contacts",
          });
          setLastError(null);
          importMutation.mutate({ returnTo: buildReturnTo(true) });
        }}
        disabled={importMutation.isPending}
        sx={{ color: mode === "dark" ? "#000" : "#fff" }}
      >
        {importMutation.isPending ? "Importing Contacts..." : "Import Google Contacts"}
      </Button>
    </Stack>
  );
}
