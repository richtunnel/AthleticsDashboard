"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POLL_INTERVAL_MS = 2000;

type ImportMode = "idle" | "submitting" | "polling" | "done" | "error";

interface JobProgress {
  current?: number;
  total?: number;
  message?: string;
}

interface ImportResult {
  added?: number;
  duplicates?: number;
  failed?: number;
  total?: number;
}

interface BulkImportModalProps {
  open: boolean;
  groupId: string;
  groupName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function parseEmails(raw: string): { valid: string[]; invalid: string[] } {
  const tokens = raw.split(/[\s,;\n]+/).map((t) => t.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (!EMAIL_REGEX.test(lower)) {
      invalid.push(token);
    } else if (!seen.has(lower)) {
      seen.add(lower);
      valid.push(lower);
    }
    // silently deduplicate
  }

  return { valid, invalid };
}

export function BulkImportModal({ open, groupId, groupName, onClose, onSuccess }: BulkImportModalProps) {
  const [rawInput, setRawInput] = useState("");
  const [mode, setMode] = useState<ImportMode>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parsed preview counts
  const { valid, invalid } = parseEmails(rawInput);

  // Clear state when modal opens
  useEffect(() => {
    if (open) {
      setRawInput("");
      setMode("idle");
      setJobId(null);
      setProgress(null);
      setResult(null);
      setErrorMsg(null);
      setCsvError(null);
    }
  }, [open]);

  // Cleanup poller on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // ── CSV / TXT upload ─────────────────────────────────────────────────────
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Accept CSV and plain text files
    if (!file.name.match(/\.(csv|txt)$/i)) {
      setCsvError("Only .csv and .txt files are supported");
      return;
    }

    setCsvError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      // Strip CSV headers: if first token is clearly a header word, skip the first line
      const lines = text.split(/\r?\n/);
      const firstLine = lines[0]?.toLowerCase() ?? "";
      const startsWithHeader = /^(email|emails|address|contact|name)/.test(firstLine.trim());
      const content = startsWithHeader ? lines.slice(1).join("\n") : text;
      setRawInput((prev) => (prev.trim() ? prev + "\n" + content : content));
    };
    reader.readAsText(file);
    // Reset so the same file can be re-uploaded if needed
    e.target.value = "";
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (valid.length === 0) return;

    setMode("submitting");
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/email-groups/${groupId}/emails/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: valid }),
      });

      const data = await res.json();

      if (!res.ok) {
        // 429 means another job is in flight — show jobId so user can track it
        if (res.status === 429 && data.jobId) {
          setJobId(data.jobId);
          setMode("polling");
          schedulePoll(data.jobId);
          return;
        }
        throw new Error(data.error || "Import failed");
      }

      if (data.mode === "sync") {
        // Small batch — completed inline
        setResult({ added: data.added, duplicates: data.duplicates, total: valid.length });
        setMode("done");
        onSuccess();
      } else {
        // Large batch — poll for job completion
        setJobId(data.jobId);
        setMode("polling");
        schedulePoll(data.jobId);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
      setMode("error");
    }
  }, [valid, groupId, onSuccess]);

  // ── Polling ──────────────────────────────────────────────────────────────
  const schedulePoll = useCallback((id: string) => {
    pollTimerRef.current = setTimeout(() => pollJob(id), POLL_INTERVAL_MS);
  }, []);

  const pollJob = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/email-groups/${groupId}/emails/import?jobId=${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to poll job status");
      }

      const data = await res.json();
      setProgress(data.progress ?? null);

      if (data.status === "COMPLETED") {
        const r = data.result as ImportResult | null;
        setResult(r ?? { total: valid.length });
        setMode("done");
        onSuccess();
      } else if (data.status === "FAILED") {
        setErrorMsg(data.error || "Import job failed");
        setMode("error");
      } else {
        // Still PENDING or PROCESSING — keep polling
        schedulePoll(id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Lost connection to import job");
      setMode("error");
    }
  }, [groupId, valid.length, onSuccess, schedulePoll]);

  // ── Progress percentage ───────────────────────────────────────────────────
  const progressPct =
    progress?.total && progress.current != null
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isWorking = mode === "submitting" || mode === "polling";

  const handleClose = () => {
    if (isWorking) return; // don't close while import is running
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Bulk Import Emails
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Import into <strong>{groupName}</strong>
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* ── Idle / input state ── */}
          {(mode === "idle" || mode === "error") && (
            <>
              <Alert severity="info" sx={{ fontSize: "0.8rem" }}>
                Paste emails separated by commas, spaces, or new lines — or upload a .csv / .txt file.
                Batches over 50 emails are processed in the background.
              </Alert>

              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<UploadFileIcon />}
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ textTransform: "none" }}
                >
                  Upload CSV / TXT
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
              </Box>

              {csvError && (
                <Alert severity="error" sx={{ fontSize: "0.8rem" }}>
                  {csvError}
                </Alert>
              )}

              <TextField
                label="Email addresses"
                placeholder={"alice@school.edu\nbob@district.org, charlie@team.com"}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                multiline
                minRows={5}
                maxRows={12}
                fullWidth
                disabled={isWorking}
              />

              {rawInput.trim() && (
                <Box sx={{ display: "flex", gap: 2 }}>
                  <Typography variant="caption" color="success.main">
                    ✓ {valid.length} valid
                  </Typography>
                  {invalid.length > 0 && (
                    <Typography variant="caption" color="warning.main">
                      ✕ {invalid.length} invalid (will be skipped)
                    </Typography>
                  )}
                </Box>
              )}

              {mode === "error" && errorMsg && (
                <Alert severity="error" icon={<ErrorOutlineIcon />}>
                  {errorMsg}
                </Alert>
              )}
            </>
          )}

          {/* ── Submitting / polling state ── */}
          {(mode === "submitting" || mode === "polling") && (
            <Box sx={{ textAlign: "center", py: 2 }}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography variant="body2" sx={{ mb: 1 }}>
                {mode === "submitting"
                  ? "Sending import request…"
                  : progress?.message ?? "Importing emails in the background…"}
              </Typography>

              {progressPct != null && (
                <>
                  <LinearProgress
                    variant="determinate"
                    value={progressPct}
                    sx={{ borderRadius: 1, mb: 0.5 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {progress?.current?.toLocaleString()} / {progress?.total?.toLocaleString()} emails
                  </Typography>
                </>
              )}

              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                You can leave this page — the import will continue in the background.
              </Typography>
            </Box>
          )}

          {/* ── Done state ── */}
          {mode === "done" && result && (
            <Box sx={{ textAlign: "center", py: 2 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 48, color: "success.main", mb: 1 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Import Complete
              </Typography>
              <Stack spacing={0.5} alignItems="center">
                <Typography variant="body2">
                  <strong>{(result.added ?? 0).toLocaleString()}</strong> emails added
                </Typography>
                {(result.duplicates ?? 0) > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {result.duplicates?.toLocaleString()} duplicates skipped
                  </Typography>
                )}
                {(result.failed ?? 0) > 0 && (
                  <Typography variant="body2" color="error.main">
                    {result.failed?.toLocaleString()} failed (transient error)
                  </Typography>
                )}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isWorking} sx={{ textTransform: "none" }}>
          {mode === "done" ? "Close" : "Cancel"}
        </Button>

        {(mode === "idle" || mode === "error") && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={valid.length === 0}
            sx={{ textTransform: "none" }}
          >
            Import {valid.length > 0 ? `${valid.length.toLocaleString()} emails` : ""}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
