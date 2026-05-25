"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { TipBubble } from "@/components/tips/TipBubble";
import { TIP_IDS } from "@/components/tips/tipIds";
import Papa from "papaparse";
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Alert,
  Chip,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Stepper,
  Step,
  StepLabel,
  Grid,
} from "@mui/material";
import Link from "next/link";
import { CloudUpload, Close, CheckCircle, Error as ErrorIcon, Download, Visibility, Warning } from "@mui/icons-material";
import GoogleIcon from "@mui/icons-material/Google";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { parseAndConvertDate, parseAndConvertTime } from "@/lib/utils/dateTimeParser";
import { trackEvent } from "@/lib/analytics/mixpanel.services";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { useTheme as customTheme } from "@mui/material/styles";

const dateStringToUTCISOString = (dateValue: string): string => {
  // Use robust date parser that handles multiple formats
  // Note: parseAndConvertDate returns full ISO string, we only need the date part for this component
  const isoString = parseAndConvertDate(dateValue);
  return isoString.split("T")[0];
};

interface CSVImportProps {
  onImportComplete?: (result: ImportResult) => void;
  onClose?: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  duplicates?: number;
  errors: string[];
  warnings?: string[];
  duplicateDetails?: string[];
  createdGameIds?: string[];
}

interface ParsedRow {
  [key: string]: string | number | null;
}

interface FieldMapping {
  [csvField: string]: string; // Maps CSV column to database field
}

const DATABASE_FIELDS = [
  { value: "date", label: "Date (Required - maps to game date)", required: true },
  { value: "preserve", label: "Keep as Custom Column", required: false },
  { value: "skip", label: "Skip Column", required: false },
];

export function ImportBox({ onImportComplete, onClose }: CSVImportProps) {
  const theme = customTheme();
  const { mode } = useTheme();
  const [step, setStep] = useState(0); // 0: upload, 1: mapping, 2: preview, 3: importing
  // Anchor for the first-login dropzone TipBubble (top-right marker)
  const [dropzoneTipAnchor, setDropzoneTipAnchor] = useState<HTMLDivElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Drag and drop handling
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFile(file);
    setValidationErrors([]);

    // Parse CSV
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      transformHeader: (header: any) => header.trim(),
      complete: (results: any) => {
        const data = results.data as ParsedRow[];
        const headers = results.meta.fields || [];

        setHeaders(headers);
        setParsedData(data);

        // Auto-map common fields
        const autoMapping = autoMapFields(headers);
        setFieldMapping(autoMapping);

        // Move to mapping step
        setStep(1);
      },
      error: (error: any) => {
        setValidationErrors([`CSV Parse Error: ${error.message}`]);
      },
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const autoMapFields = (csvHeaders: string[]): FieldMapping => {
    const mapping: FieldMapping = {};

    csvHeaders.forEach((header) => {
      const normalized = header.toLowerCase().trim();

      // Check if this looks like a date column for special handling
      if (normalized.includes("date")) {
        // Still preserve date columns as custom columns, but we'll format them specially
        mapping[header] = "preserve";
      }
      // All other columns are preserved as custom columns by default
      else {
        mapping[header] = "preserve";
      }
    });

    // Auto-select the first date-like column as the required date field
    const dateColumn = csvHeaders.find((header) => header.toLowerCase().trim().includes("date"));
    if (dateColumn) {
      mapping[dateColumn] = "date";
    }

    return mapping;
  };

  // Validate mapped data
  const validateData = (): boolean => {
    const errors: string[] = [];

    // Check required fields are mapped
    const requiredFields = DATABASE_FIELDS.filter((f) => f.required).map((f) => f.value);
    const mappedFields = Object.values(fieldMapping);

    requiredFields.forEach((field) => {
      if (!mappedFields.includes(field)) {
        errors.push(`Required field "${field}" is not mapped`);
      }
    });

    // Validate data quality
    if (parsedData.length === 0) {
      errors.push("No data rows found in CSV");
    }

    // Sample validation - check first few rows
    const sampleSize = Math.min(5, parsedData.length);
    for (let i = 0; i < sampleSize; i++) {
      const row = parsedData[i];

      // Check date field
      const dateField = Object.keys(fieldMapping).find((k) => fieldMapping[k] === "date");
      if (dateField && row[dateField]) {
        const dateValue = row[dateField];
        const parsedDate = new Date(dateValue as string);
        if (isNaN(parsedDate.getTime())) {
          errors.push(`Row ${i + 2}: Invalid date format "${dateValue}"`);
        }
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Preview mapped data
  const handlePreview = () => {
    if (validateData()) {
      setStep(2);
    }
  };

  const transformData = (row: ParsedRow, rowIndex?: number): Record<string, any> => {
    try {
      const transformed: Record<string, any> = {
        customFields: {} as Record<string, any>,
      };

      Object.keys(fieldMapping).forEach((csvField) => {
        const dbField = fieldMapping[csvField];
        if (dbField === "skip") return;

        const value = row[csvField];

        // Transform specific fields
        switch (dbField) {
          case "date":
            try {
              transformed.date = value ? parseAndConvertDate(value as string | number) : null;
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : "Invalid date";
              throw new Error(`Invalid date in column "${csvField}": ${errorMsg}`);
            }
            break;
          case "preserve":
            // Check if this is a date-like column for special formatting
            const isDateLikeColumn = /date|day/i.test(csvField);

            if (isDateLikeColumn && value) {
              try {
                // Try to format as date for consistent storage
                const parsedDate = parseAndConvertDate(value as string | number);
                // Store just the date part (YYYY-MM-DD) for date columns
                transformed.customFields[csvField] = parsedDate.split("T")[0];
              } catch {
                // If parsing fails, store raw value
                transformed.customFields[csvField] = value !== null && value !== undefined ? String(value) : null;
              }
            } else {
              // Store all preserved columns as custom fields with their original names
              transformed.customFields[csvField] = value !== null && value !== undefined ? String(value) : null;
            }
            break;
        }
      });

      return transformed;
    } catch (error) {
      const rowNum = rowIndex !== undefined ? ` (Row ${rowIndex + 2})` : "";
      throw new Error(`Transform error${rowNum}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Handle import
  const handleImport = async () => {
    setIsImporting(true);
    setImportProgress(0);
    setStep(3);

    trackEvent("Import Games Clicked", {
      source: "import_box",
      action: "import_button",
      total_rows: parsedData.length,
      file_name: file?.name,
    });

    const batchSize = 50;
    const totalBatches = Math.ceil(parsedData.length / batchSize);
    let successCount = 0;
    let failedCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];
    const allCreatedGameIds: string[] = [];

    // Extract column names and order from CSV headers
    // Store the actual order of columns as they appear in the CSV
    const customColumns: string[] = [];
    const columnMapping: Record<string, string> = {};

    headers.forEach((csvColumn) => {
      const dbField = fieldMapping[csvColumn];
      if (dbField === "date") {
        // The actual date field that maps to game.date - this one gets special treatment
        // Don't add it to customColumns since it's not a custom column
        columnMapping[csvColumn] = "date";
      } else if (dbField === "preserve") {
        // ALL preserved columns (including date-like ones) are stored as custom columns
        customColumns.push(csvColumn);
        columnMapping[csvColumn] = "preserve";
      }
    });

    try {
      for (let i = 0; i < totalBatches; i++) {
        const batch = parsedData.slice(i * batchSize, (i + 1) * batchSize);
        const batchStartIndex = i * batchSize;

        // Transform batch with error handling for each row
        const transformedBatch: Record<string, string | boolean | null>[] = [];
        batch.forEach((row, idx) => {
          try {
            const transformed = transformData(row, batchStartIndex + idx);
            transformedBatch.push(transformed);
          } catch (error) {
            failedCount++;
            const rowNum = batchStartIndex + idx + 2; // +2 for header row and 1-based indexing
            errors.push(`Row ${rowNum}: ${error instanceof Error ? error.message : "Transform failed"}`);
          }
        });

        // Only send batch if there are valid rows
        if (transformedBatch.length > 0) {
          try {
            // Send batch to API with column configuration (only send once in first batch)
            const requestBody: any = { games: transformedBatch };
            if (i === 0) {
              requestBody.customColumns = customColumns;
              requestBody.columnMapping = columnMapping;
            }

            const response = await fetch("/api/import/games/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
            });

            const result = await response.json();

            if (result.success) {
              successCount += result.data.success || 0;
              failedCount += result.data.failed || 0;
              duplicateCount += result.data.duplicates || 0;
              if (result.data.errors) {
                errors.push(...result.data.errors);
              }
              // Collect created game IDs
              if (result.data.createdGameIds) {
                allCreatedGameIds.push(...result.data.createdGameIds);
              }
            } else {
              failedCount += transformedBatch.length;
              errors.push(`Batch ${i + 1} failed: ${result.error}`);
            }
          } catch (fetchError) {
            failedCount += transformedBatch.length;
            errors.push(`Batch ${i + 1} network error: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`);
          }
        }

        // Update progress
        setImportProgress(((i + 1) / totalBatches) * 100);
      }

      const finalResult: ImportResult = {
        success: successCount,
        failed: failedCount,
        duplicates: duplicateCount,
        errors,
        createdGameIds: allCreatedGameIds,
      };

      trackEvent("Import Games Complete", {
        source: "import_box",
        success_count: successCount,
        failed_count: failedCount,
        total_count: successCount + failedCount,
        has_errors: failedCount > 0,
      });

      setImportResult(finalResult);
      onImportComplete?.(finalResult);
    } catch (error) {
      trackEvent("Import Games Error", {
        source: "import_box",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      setValidationErrors([`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`]);
    } finally {
      setIsImporting(false);
    }
  };

  // Reset to initial state
  const handleReset = () => {
    setStep(0);
    setFile(null);
    setParsedData([]);
    setHeaders([]);
    setFieldMapping({});
    setValidationErrors([]);
    setImportResult(null);
    setImportProgress(0);
  };

  // Download sample CSV template
  const handleDownloadTemplate = () => {
    const headers = ["date", "time", "sport", "level", "opponent", "home_away", "venue", "location", "status", "confirmed", "notes"];
    const sampleData = [
      ["2024-01-15", "15:00", "Basketball", "VARSITY", "Lincoln High", "Home", "Main Gym", "123 Main St", "CONFIRMED", "yes", "Senior Night"],
      ["2024-01-20", "18:30", "Football", "JV", "Roosevelt HS", "Away", "Roosevelt Stadium", "456 Oak Ave", "SCHEDULED", "no", ""],
    ];

    const csv = [headers.join(","), ...sampleData.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "games_import_template.csv";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <>
      <Grid container spacing={3} sx={{ mb: 4, maxWidth: "991px" }}>
        <Grid size={{ xs: 12 }}>
          {/* Stepper */}
          <Stepper activeStep={step} sx={{ mb: 4 }}>
            <Step>
              <StepLabel>Upload CSV</StepLabel>
            </Step>
            <Step>
              <StepLabel>Map Fields</StepLabel>
            </Step>
            <Step>
              <StepLabel>Preview & Confirm</StepLabel>
            </Step>
            <Step>
              <StepLabel>Import</StepLabel>
            </Step>
          </Stepper>

          {/* Step 0: Upload */}
          {step === 0 && (
            <Stack spacing={3}>
              <Box sx={{ position: "relative" }}>
                {/* Invisible 1×1 anchor at the top-right corner of the dropzone.
                    Using a positioned marker (not the Paper itself) so the
                    TipBubble's arrow lands on the corner instead of the
                    centre, and so the bubble doesn't intercept drops. */}
                <Box
                  ref={setDropzoneTipAnchor}
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 12,
                    width: 1,
                    height: 1,
                    pointerEvents: "none",
                  }}
                />
                <Paper
                  {...getRootProps()}
                  sx={{
                    p: 6,
                    border: "2px dashed",
                    borderColor: isDragActive ? (mode === "dark" ? "divider" : "primary.main") : mode === "dark" ? "transparent" : "primary.main",
                    bgcolor: isDragActive ? "action.hover" : "background.paper",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.3s",
                    "&:hover": {
                      borderColor: "primary.main",
                      bgcolor: "action.hover",
                    },
                  }}
                >
                  <input {...getInputProps()} />
                  <CloudUpload sx={{ fontSize: 64, color: "primary.main", mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    {isDragActive ? "Drop your CSV file here" : "Drag & drop CSV file here"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    or click to browse files
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Maximum file size: 10MB • Supported format: CSV
                  </Typography>
                </Paper>
              </Box>
              <TipBubble
                tipId={TIP_IDS.OVERVIEW_DROPZONE}
                anchorEl={dropzoneTipAnchor}
                placement="bottom-end"
                title="Start by uploading your schedule"
                body="Drop in your Sport Schedule CSV here to get started. Opletics will map the columns and load your games automatically."
              />

              <Box textAlign="center">
                <Button
                  sx={{ ml: "12px", marginBottom: "8px", borderColor: theme.palette.text.secondary, color: theme.palette.text.secondary }}
                  startIcon={<Download />}
                  onClick={handleDownloadTemplate}
                  variant="outlined"
                >
                  Download Sample Template
                </Button>
                <Button variant="outlined" sx={{ ml: "12px", marginBottom: "8px", borderColor: theme.palette.text.secondary, color: theme.palette.text.secondary }}>
                  <Link href="https://docs.google.com/spreadsheets/u/0/" rel="noopener" target="_blank" style={{ color: "inherit" }}>
                    Open Googlesheets&nbsp;
                    <OpenInNewIcon fontSize="small" />
                  </Link>
                </Button>
                <Button sx={{ ml: "12px", marginBottom: "8px", borderColor: theme.palette.text.secondary, color: theme.palette.text.secondary }} variant="outlined">
                  <Link href="https://excel.cloud.microsoft" rel="noopener" target="_blank" style={{ color: "inherit" }}>
                    Open excel&nbsp;
                    <OpenInNewIcon />
                  </Link>
                </Button>
              </Box>

              {validationErrors.length > 0 && (
                <Alert severity="error">
                  {validationErrors.map((error, idx) => (
                    <div key={idx}>{error}</div>
                  ))}
                </Alert>
              )}
            </Stack>
          )}

          {/* Step 1: Field Mapping */}
          {step === 1 && (
            <Stack spacing={3}>
              <Alert severity="info">
                Only the <strong>Date</strong> column is required for import. All other columns will be preserved exactly as they appear in your spreadsheet. You can skip any columns you don&apos;t
                want to import.
              </Alert>

              <Typography variant="subtitle2" color="text.secondary">
                File: <strong>{file?.name}</strong> • Rows: <strong>{parsedData.length}</strong>
              </Typography>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>CSV Column</TableCell>
                      <TableCell>Sample Data</TableCell>
                      <TableCell width={250}>Maps To</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {headers.map((header) => (
                      <TableRow key={header}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {header}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                            {String(parsedData[0]?.[header] || "")}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <FormControl fullWidth size="small">
                            <Select
                              value={fieldMapping[header] || "skip"}
                              onChange={(e) =>
                                setFieldMapping({
                                  ...fieldMapping,
                                  [header]: e.target.value,
                                })
                              }
                            >
                              {DATABASE_FIELDS.map((field) => (
                                <MenuItem key={field.value} value={field.value}>
                                  {field.label}
                                  {field.required && " *"}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {validationErrors.length > 0 && (
                <Alert severity="error">
                  {validationErrors.map((error, idx) => (
                    <div key={idx}>{error}</div>
                  ))}
                </Alert>
              )}
            </Stack>
          )}

          {/* Step 2: Preview */}
          {step === 2 && (
            <Stack spacing={3}>
              <Alert severity="success">Data validated successfully! Review the preview below before importing.</Alert>

              <Typography variant="subtitle2" color="text.secondary">
                Preview of first 5 rows • Total rows to import: <strong>{parsedData.length}</strong>
              </Typography>

              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {Object.values(fieldMapping)
                        .filter((f) => f !== "skip")
                        .map((field) => (
                          <TableCell key={field}>
                            <Typography variant="caption" fontWeight={600}>
                              {DATABASE_FIELDS.find((f) => f.value === field)?.label}
                            </Typography>
                          </TableCell>
                        ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parsedData.slice(0, 5).map((row, idx) => (
                      <TableRow key={idx}>
                        {Object.entries(fieldMapping)
                          .filter(([, dbField]) => dbField !== "skip")
                          .map(([csvField, dbField]) => {
                            const transformed = transformData(row);
                            return (
                              <TableCell key={csvField}>
                                <Typography variant="body2">{String(transformed[dbField] || "—")}</Typography>
                              </TableCell>
                            );
                          })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}

          {/* Step 3: Importing */}
          {step === 3 && (
            <Stack spacing={3} alignItems="center">
              {isImporting ? (
                <>
                  <CloudUpload sx={{ fontSize: 64, color: "primary.main" }} />
                  <Typography variant="h6">Importing games...</Typography>
                  <Box width="100%">
                    <LinearProgress variant="determinate" value={importProgress} />
                    <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 1 }}>
                      {Math.round(importProgress)}% complete
                    </Typography>
                  </Box>
                </>
              ) : importResult ? (
                <>
                  {importResult.success === 0 && importResult.failed > 0 ? (
                    <>
                      <Warning sx={{ fontSize: 64, color: "warning.main" }} />
                      <Typography variant="h6">Import Warning!</Typography>
                      <Typography variant="body2" color="text.secondary">
                        0 games imported, {importResult.failed} duplicated games found, failed!
                      </Typography>
                    </>
                  ) : (
                    <>
                      <CheckCircle sx={{ fontSize: 64, color: "success.main" }} />
                      <Typography variant="h6">Import Complete!</Typography>
                      <Stack direction="row" spacing={2} flexWrap="wrap">
                        <Chip icon={<CheckCircle />} label={`${importResult.success} Successful`} color="success" />
                        {importResult.failed > 0 && <Chip icon={<ErrorIcon />} label={`${importResult.failed} Failed`} color="error" />}
                        {(importResult.duplicates ?? 0) > 0 && <Chip label={`${importResult.duplicates} Duplicates Skipped`} color="warning" />}
                      </Stack>
                    </>
                  )}

                  {importResult.duplicateDetails && importResult.duplicateDetails.length > 0 && (
                    <Alert severity="warning" sx={{ width: "100%" }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Duplicate Rows Skipped ({importResult.duplicateDetails.length}):
                      </Typography>
                      <Box sx={{ maxHeight: 150, overflow: "auto" }}>
                        {importResult.duplicateDetails.slice(0, 10).map((duplicate, idx) => (
                          <Typography key={idx} variant="caption" display="block">
                            • {duplicate}
                          </Typography>
                        ))}
                        {importResult.duplicateDetails.length > 10 && (
                          <Typography variant="caption" color="text.secondary">
                            ... and {importResult.duplicateDetails.length - 10} more duplicates
                          </Typography>
                        )}
                      </Box>
                    </Alert>
                  )}

                  {importResult.warnings && importResult.warnings.length > 0 && (
                    <Alert severity="info" sx={{ width: "100%" }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Data Adjustments ({importResult.warnings.length}):
                      </Typography>
                      <Box sx={{ maxHeight: 150, overflow: "auto" }}>
                        {importResult.warnings.slice(0, 10).map((warning, idx) => (
                          <Typography key={idx} variant="caption" display="block">
                            • {warning}
                          </Typography>
                        ))}
                        {importResult.warnings.length > 10 && (
                          <Typography variant="caption" color="text.secondary">
                            ... and {importResult.warnings.length - 10} more adjustments
                          </Typography>
                        )}
                      </Box>
                    </Alert>
                  )}

                  {importResult.errors.length > 0 && (
                    <Alert severity="warning" sx={{ width: "100%" }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Import Errors:
                      </Typography>
                      <Box sx={{ maxHeight: 200, overflow: "auto" }}>
                        {importResult.errors.slice(0, 10).map((error, idx) => (
                          <Typography key={idx} variant="caption" display="block">
                            • {error}
                          </Typography>
                        ))}
                        {importResult.errors.length > 10 && (
                          <Typography variant="caption" color="text.secondary">
                            ... and {importResult.errors.length - 10} more errors
                          </Typography>
                        )}
                      </Box>
                    </Alert>
                  )}
                </>
              ) : (
                <>
                  <ErrorIcon sx={{ fontSize: 64, color: "error.main" }} />
                  <Typography variant="h6">Import Failed</Typography>
                  <Alert severity="error" sx={{ width: "100%" }}>
                    {validationErrors.map((error, idx) => (
                      <div key={idx}>{error}</div>
                    ))}
                  </Alert>
                </>
              )}
            </Stack>
          )}

          <DialogActions>
            {/* {step === 0 && <Button onClick={onClose}>Cancel</Button>} */}

            {step === 1 && (
              <>
                <Button onClick={handleReset}>Back</Button>
                <Button variant="contained" onClick={handlePreview}>
                  Next: Preview
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <Button onClick={() => setStep(1)}>Back</Button>
                <Button variant="contained" onClick={handleImport} startIcon={<CloudUpload />}>
                  Import {parsedData.length} Games
                </Button>
              </>
            )}

            {step === 3 && !isImporting && (
              <>
                <Button onClick={handleReset}>Import Another File</Button>
                <Link href={"/dashboard/games"}>View</Link>
              </>
            )}
          </DialogActions>
        </Grid>
      </Grid>
    </>
  );
}
