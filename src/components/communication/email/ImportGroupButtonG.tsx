"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, CircularProgress, Stack } from "@mui/material";
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

  return (
    <Stack spacing={1} direction="column" alignItems="flex-start">
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

      {importMutation.isSuccess && !lastError && (
        <Alert severity="success" sx={{ width: "100%" }}>
          {importMutation.data?.message || "Email groups imported successfully."}
        </Alert>
      )}

      {lastError && (
        <Alert severity="error" onClose={() => setLastError(null)} sx={{ width: "100%" }}>
          Import Error: {lastError}
        </Alert>
      )}
    </Stack>
  );
}
