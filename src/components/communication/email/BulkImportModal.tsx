"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, TextField, Typography } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

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
  clamped?: number;
  contactLimit?: number | null;
}

interface BulkImportModalProps {
  open: boolean;
  groupId: string;
  groupName: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ── CSV parser ────────────────────────────────────────────────────────────────
/**
 * Parses CSV text into rows of cells.
 * Handles quoted fields (including embedded commas and newlines inside quotes),
 * CRLF / LF line endings, and leading BOM characters.
 */
function parseCsvRows(text: string): string[][] {
  // Strip BOM
  const clean = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < clean.length) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        // Escaped quote inside a quoted field
        cell += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      i++;
      continue;
    }

    if (ch === "\r" && next === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      i += 2;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }

    cell += ch;
    i++;
  }

  // Flush the last cell / row
  if (cell.trim() || row.length > 0) {
    row.push(cell.trim());
    if (row.some((c) => c !== "")) rows.push(row);
  }

  return rows;
}

/** Header keywords that indicate an email column */
const EMAIL_HEADER_PATTERNS = /^(e[- ]?mail(s|[ _]address(es)?)?|contact)$/i;

/**
 * Extract email addresses from a parsed CSV.
 * Strategy:
 *   1. If the first row looks like a header, find the email column by name.
 *   2. Otherwise scan every cell in every row for valid email-shaped values.
 */
function extractEmailsFromCsv(rows: string[][]): string[] {
  if (rows.length === 0) return [];

  const seen = new Set<string>();

  const firstRow = rows[0];
  // Try to locate a dedicated email column in the header
  const emailColIndex = firstRow.findIndex((cell) => EMAIL_HEADER_PATTERNS.test(cell.trim()));

  if (emailColIndex !== -1) {
    // Header row found — skip row 0, extract from the identified column
    for (let r = 1; r < rows.length; r++) {
      const cell = rows[r][emailColIndex]?.trim().toLowerCase();
      if (cell && EMAIL_REGEX.test(cell) && !seen.has(cell)) {
        seen.add(cell);
      }
    }
    return Array.from(seen);
  }

  // No explicit header — scan every cell for anything that looks like an email
  for (const row of rows) {
    for (const cell of row) {
      const val = cell.trim().toLowerCase();
      if (val && EMAIL_REGEX.test(val) && !seen.has(val)) {
        seen.add(val);
      }
    }
  }
  return Array.from(seen);
}

// ── Text-area paste parser ────────────────────────────────────────────────────
function parseEmailsFromText(raw: string): { valid: string[]; invalid: string[] } {
  const tokens = raw
    .split(/[\s,;\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
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
  }

  return { valid, invalid };
}

// ─────────────────────────────────────────────────────────────────────────────

export function BulkImportModal({ open, groupId, groupName, onClose, onSuccess }: BulkImportModalProps) {
  const [rawInput, setRawInput] = useState("");
  const [mode, setMode] = useState<ImportMode>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvEmails, setCsvEmails] = useState<string[] | null>(null); // emails extracted from CSV
  const [csvError, setCsvError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parsed preview from text area (only used when no CSV is loaded)
  const textParsed = parseEmailsFromText(rawInput);

  // The final list used for import: CSV takes precedence over textarea
  const emailsToSubmit: string[] = csvEmails ?? textParsed.valid;
  const invalidCount = csvEmails ? 0 : textParsed.invalid.length;

  // Clear state when modal opens
  useEffect(() => {
    if (open) {
      setRawInput("");
      setMode("idle");
      setJobId(null);
      setProgress(null);
      setResult(null);
      setErrorMsg(null);
      setCsvFileName(null);
      setCsvEmails(null);
      setCsvError(null);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // ── CSV upload ─────────────────────────────────────────────────────────────
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvError("Only .csv files are accepted. Please export your contacts as a CSV and try again.");
      e.target.value = "";
      return;
    }

    setCsvError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = parseCsvRows(text);
      const emails = extractEmailsFromCsv(rows);

      if (emails.length === 0) {
        setCsvError("No valid email addresses found in the CSV. Make sure the file has an 'Email' column or contains email addresses in any column.");
        setCsvEmails(null);
        setCsvFileName(null);
      } else {
        setCsvEmails(emails);
        setCsvFileName(file.name);
        // Clear the text area if we have CSV data
        setRawInput("");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleClearCsv = useCallback(() => {
    setCsvEmails(null);
    setCsvFileName(null);
    setCsvError(null);
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (emailsToSubmit.length === 0) return;

    setMode("submitting");
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/email-groups/${groupId}/emails/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: emailsToSubmit }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429 && data.jobId) {
          // Another job is already running — track it
          setJobId(data.jobId);
          setMode("polling");
          schedulePoll(data.jobId);
          return;
        }
        throw new Error(data.error || "Import failed");
      }

      if (data.mode === "sync") {
        setResult({ added: data.added, duplicates: data.duplicates, clamped: data.clamped, contactLimit: data.contactLimit });
        setMode("done");
        onSuccess();
      } else {
        setJobId(data.jobId);
        setMode("polling");
        schedulePoll(data.jobId);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
      setMode("error");
    }
  }, [emailsToSubmit, groupId, onSuccess]);

  // ── Polling ────────────────────────────────────────────────────────────────
  const schedulePoll = useCallback((id: string) => {
    pollTimerRef.current = setTimeout(() => pollJob(id), POLL_INTERVAL_MS);
  }, []);

  const pollJob = useCallback(
    async (id: string) => {
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
          setResult(r ?? ({ total: emailsToSubmit.length } as ImportResult));
          setMode("done");
          onSuccess();
        } else if (data.status === "FAILED") {
          setErrorMsg(data.error || "Import job failed");
          setMode("error");
        } else {
          schedulePoll(id);
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Lost connection to import job");
        setMode("error");
      }
    },
    [groupId, emailsToSubmit.length, onSuccess, schedulePoll],
  );

  // ── Derived state ──────────────────────────────────────────────────────────
  const progressPct = progress?.total && progress.current != null ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : null;

  const isWorking = mode === "submitting" || mode === "polling";

  const handleClose = () => {
    if (isWorking) return;
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
          {/* ── Idle / error input state ── */}
          {(mode === "idle" || mode === "error") && (
            <>
              <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ fontSize: "0.8rem" }}>
                <strong>CSV files only.</strong> Upload a .csv file with an <em>Email</em> column, or paste email addresses directly into the text box below. Duplicates are automatically skipped.
              </Alert>

              {/* CSV upload section */}
              <Box>
                <Button variant="outlined" startIcon={<UploadFileIcon />} size="small" onClick={() => fileInputRef.current?.click()} sx={{ textTransform: "none" }}>
                  Upload CSV File
                </Button>
                <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFileUpload} />

                {csvFileName && csvEmails && (
                  <Box
                    sx={{
                      mt: 1,
                      px: 2,
                      py: 1,
                      borderRadius: 1,
                      bgcolor: "success.50",
                      border: "1px solid",
                      borderColor: "success.light",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography variant="body2">
                      <strong>{csvFileName}</strong> — {csvEmails.length.toLocaleString()} email{csvEmails.length !== 1 ? "s" : ""} found
                    </Typography>
                    <Button size="small" color="inherit" onClick={handleClearCsv} sx={{ textTransform: "none", ml: 1 }}>
                      Clear
                    </Button>
                  </Box>
                )}

                {csvError && (
                  <Alert severity="error" sx={{ mt: 1, fontSize: "0.8rem" }}>
                    {csvError}
                  </Alert>
                )}
              </Box>

              {/* Paste area — only show when no CSV is loaded */}
              {!csvEmails && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: -1 }}>
                    Or paste emails directly:
                  </Typography>
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
                        ✓ {textParsed.valid.length.toLocaleString()} valid
                      </Typography>
                      {invalidCount > 0 && (
                        <Typography variant="caption" color="warning.main">
                          ✕ {invalidCount} invalid (will be skipped)
                        </Typography>
                      )}
                    </Box>
                  )}
                </>
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
                {mode === "submitting" ? "Sending import request…" : (progress?.message ?? "Importing emails in the background…")}
              </Typography>

              {progressPct != null && (
                <>
                  <LinearProgress variant="determinate" value={progressPct} sx={{ borderRadius: 1, mb: 0.5 }} />
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
                  <strong>{(result.added ?? 0).toLocaleString()}</strong> email{result.added !== 1 ? "s" : ""} added
                </Typography>
                {(result.duplicates ?? 0) > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {result.duplicates?.toLocaleString()} duplicate{result.duplicates !== 1 ? "s" : ""} skipped
                  </Typography>
                )}
                {(result.clamped ?? 0) > 0 && (
                  <Alert severity="warning" sx={{ mt: 1, textAlign: "left" }}>
                    <Typography variant="body2">
                      <strong>
                        {result.clamped?.toLocaleString()} email{result.clamped !== 1 ? "s" : ""} were not imported
                      </strong>{" "}
                      because you reached your plan&apos;s contact limit
                      {result.contactLimit ? ` of ${result.contactLimit.toLocaleString()}` : ""}. Upgrade your plan to import more.
                    </Typography>
                  </Alert>
                )}
                {(result.failed ?? 0) > 0 && (
                  <Typography variant="body2" color="error.main">
                    {result.failed?.toLocaleString()} failed (transient error — try importing again)
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
          <Button variant="contained" onClick={handleSubmit} disabled={emailsToSubmit.length === 0} sx={{ textTransform: "none" }}>
            Import{emailsToSubmit.length > 0 ? ` ${emailsToSubmit.length.toLocaleString()} emails` : ""}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
