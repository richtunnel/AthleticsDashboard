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

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["email-groups"], refetchType: "all" });
        queryClient.invalidateQueries({ queryKey: ["user-data"] });
      } else {
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

  // Only treat as a real import-success when the server returned success=true
  // AND actually wrote at least one group. The OAuth-redirect path also flips
  // isSuccess=true momentarily before navigation, and "No groups found" is
  // technically a success too — neither should show the green confirmation.
  const importedCount = (importMutation.data as { importedGroups?: number } | undefined)?.importedGroups ?? 0;
  const trulyImported =
    importMutation.isSuccess &&
    !lastError &&
    importMutation.data?.success === true &&
    !importMutation.data?.requiresAuth &&
    importedCount > 0;

  return (
    <Stack spacing={1} direction="column" alignItems="flex-start" sx={{ width: "100%" }}>
      {/* Status slot — fixed above the button. Reserves vertical space so the
          button itself never shifts when a message appears/disappears. */}
      <Box sx={{ width: "100%", minHeight: lastError || trulyImported ? undefined : 0 }}>
        <Collapse in={trulyImported} unmountOnExit>
          <Alert severity="success" sx={{ width: "100%" }}>
            {importMutation.data?.message || "Email groups imported successfully."}
          </Alert>
        </Collapse>
        <Collapse in={!!lastError} unmountOnExit>
          <Alert severity="error" onClose={() => setLastError(null)} sx={{ width: "100%" }}>
            Import Error: {lastError}
          </Alert>
        </Collapse>
      </Box>

      <Button
        variant="contained"
        startIcon={importMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <CloudDownloadIcon />}
        onClick={() => {
          trackEvent("Import Google Groups Clicked", {
            source: "email_manager",
            action: "import_google_groups",
          });
          setLastError(null);
          importMutation.mutate({ returnTo: buildReturnTo(true) });
        }}
        disabled={importMutation.isPending}
        sx={{ color: mode === "dark" ? "#000" : "#fff" }}
      >
        {importMutation.isPending ? "Importing Groups..." : "Import Google Groups"}
      </Button>
    </Stack>
  );
}
