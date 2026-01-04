"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
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
  Stack,
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";
import { CloudUpload, Close, CheckCircle, Error as ErrorIcon, Download } from "@mui/icons-material";
import Link from "next/link";
import { parseAndConvertDate, parseAndConvertTime } from "@/lib/utils/dateTimeParser";
import { DateRequiredModal } from "./DateRequiredModal";

interface CSVImportProps {
  onImportComplete?: (result: ImportResult) => void;
  onClose?: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  duplicates?: number;
  errors: string[];
  warnings: string[];
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
  { value: "date", label: "Date", required: true },
  { value: "preserve", label: "Keep as Custom Column", required: false },
  { value: "skip", label: "Skip Column", required: false },
];

export function CSVImport({ onImportComplete, onClose }: CSVImportProps) {
  const [step, setStep] = useState(0); // 0: upload, 1: mapping, 2: preview, 3: importing
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showDateRequiredModal, setShowDateRequiredModal] = useState(false);

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
      transformHeader: (header: string) => header.trim(),
      complete: (results: { data: ParsedRow[]; meta: { fields?: string[] } }) => {
        const data = results.data;
        const headers = results.meta.fields || [];

        setHeaders(headers);
        setParsedData(data);

        // Auto-map common fields
        const autoMapping = autoMapFields(headers);
        setFieldMapping(autoMapping);

        // Move to mapping step
        setStep(1);
      },
      error: (error: Error) => {
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

  // Auto-map common field names - now only looks for date column
  const autoMapFields = (csvHeaders: string[]): FieldMapping => {
    const mapping: FieldMapping = {};

    csvHeaders.forEach((header) => {
      const normalized = header.toLowerCase().trim();

      // Date mapping - only required field
      if (normalized.includes("date")) {
        mapping[header] = "date";
      }
      // All other columns are preserved as custom columns by default
      else {
        mapping[header] = "preserve";
      }
    });

    return mapping;
  };

  // Validate mapped data
  const validateData = (): boolean => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if date field is mapped - it's the only required field
    const mappedFields = Object.values(fieldMapping);
    if (!mappedFields.includes("date")) {
      // Show date required modal instead of just an error
      setShowDateRequiredModal(true);
      return false;
    }

    // Validate data quality
    if (parsedData.length === 0) {
      errors.push("No data rows found in CSV");
    }

    // Validate all rows for date issues
    const dateField = Object.keys(fieldMapping).find((k) => fieldMapping[k] === "date");
    if (dateField) {
      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        if (row[dateField]) {
          try {
            const dateValue = row[dateField];
            // Try to parse the date using our robust parser with warnings
            const result = parseAndConvertDate(dateValue as string | number, true);
            if (result.warnings.length > 0) {
              result.warnings.forEach((warning) => {
                warnings.push(`Row ${i + 2}: ${warning}`);
              });
            }
          } catch (error) {
            errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : "Invalid date"}`);
          }
        } else {
          // Row is missing date value
          warnings.push(`Row ${i + 2}: Missing date value`);
        }
      }
    }

    setValidationErrors(errors);
    setValidationWarnings(warnings);
    return errors.length === 0;
  };

  // Preview mapped data
  const handlePreview = () => {
    if (validateData()) {
      setStep(2);
    }
  };

  // Transform CSV data to game format - new structure preserves custom columns
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
              const dateValue = value ? parseAndConvertDate(value as string | number) : null;
              transformed.date = dateValue; // For calendar widget
              transformed.customFields[csvField] = dateValue; // For table display
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : "Invalid date";
              throw new Error(`Invalid date in column "${csvField}": ${errorMsg}`);
            }
            break;
          case "preserve":
            // Store all preserved columns as custom fields with their original names
            transformed.customFields[csvField] = value !== null && value !== undefined ? String(value) : null;
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

    const batchSize = 50;
    const totalBatches = Math.ceil(parsedData.length / batchSize);
    let successCount = 0;
    let failedCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];
    const warnings: string[] = [];
    const allCreatedGameIds: string[] = [];

    // Extract column names and order from CSV headers
    // Store the actual order of columns as they appear in the CSV
    const customColumns: string[] = [];
    const columnMapping: Record<string, string> = {};

    headers.forEach((csvColumn) => {
      const dbField = fieldMapping[csvColumn];
      if (dbField === "date") {
        // Date column always comes first
        customColumns.unshift(csvColumn);
        columnMapping[csvColumn] = "date";
      } else if (dbField === "preserve") {
        // Preserved columns maintain their order
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
              if (result.data.warnings) {
                warnings.push(...result.data.warnings);
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

      // Add validation warnings to the final result
      warnings.push(...validationWarnings);

      const finalResult: ImportResult = {
        success: successCount,
        failed: failedCount,
        duplicates: duplicateCount,
        errors,
        warnings,
        createdGameIds: allCreatedGameIds,
      };

      setImportResult(finalResult);
      onImportComplete?.(finalResult);
    } catch (error) {
      setValidationErrors([`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`]);
      setImportResult({
        success: successCount,
        failed: failedCount + parsedData.length - successCount - failedCount,
        errors: [...errors, `Critical error: ${error instanceof Error ? error.message : "Unknown error"}`],
        warnings,
        createdGameIds: allCreatedGameIds,
      });
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
    const headers = ["date", "sport", "level", "home_away", "opponent", "location", "time", "confirmed", "bus_travel", "notes"];
    const sampleData = [
      ["2024-01-15", "Basketball", "Varsity", "Home", "Lincoln High", "Home Gym", "15:00", "Yes", "No", "Senior Night"],
      ["2024-01-20", "Football", "JV", "Away", "Roosevelt HS", "Roosevelt Stadium", "18:30", "Yes", "Yes", "Bring extra uniforms"],
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
    <Dialog open={true} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Import Games from CSV</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
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
            <Paper
              {...getRootProps()}
              sx={{
                p: 6,
                border: "2px dashed",
                borderColor: isDragActive ? "primary.main" : "divider",
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

            <Box textAlign="center">
              <Button
                sx={(theme) => ({
                  borderColor: theme.palette.mode === "dark" ? theme.palette.themeText.text : "",
                  color: theme.palette.mode === "dark" ? theme.palette.themeText.text : "",
                })}
                startIcon={<Download />}
                onClick={handleDownloadTemplate}
                variant="outlined"
              >
                Download Sample Template
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
              Only the <strong>Date</strong> column is required for import. All other columns will be preserved exactly as they appear in your spreadsheet. You can skip any columns you don&apos;t want
              to import.
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

            {validationWarnings.length > 0 && (
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>
                  Data Adjustments ({validationWarnings.length}):
                </Typography>
                <Box sx={{ maxHeight: 150, overflow: "auto" }}>
                  {validationWarnings.slice(0, 10).map((warning, idx) => (
                    <Typography key={idx} variant="caption" display="block">
                      • {warning}
                    </Typography>
                  ))}
                  {validationWarnings.length > 10 && (
                    <Typography variant="caption" color="text.secondary">
                      ... and {validationWarnings.length - 10} more adjustments
                    </Typography>
                  )}
                </Box>
              </Alert>
            )}

            <Typography variant="subtitle2" color="text.secondary">
              Preview of first 5 rows • Total rows to import: <strong>{parsedData.length}</strong>
            </Typography>

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {headers
                      .filter((header) => fieldMapping[header] !== "skip")
                      .map((header) => (
                        <TableCell key={header}>
                          <Typography variant="caption" fontWeight={600}>
                            {header}
                            {fieldMapping[header] === "date" && " *"}
                          </Typography>
                        </TableCell>
                      ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedData.slice(0, 5).map((row, idx) => (
                    <TableRow key={idx}>
                      {headers
                        .filter((header) => fieldMapping[header] !== "skip")
                        .map((header) => {
                          try {
                            const dbField = fieldMapping[header];
                            let displayValue: any = row[header] || "—";

                            // Format date field to show only date part (not time/timezone)
                            if (dbField === "date" && displayValue !== "—") {
                              const parsedDate = parseAndConvertDate(displayValue as string | number);
                              displayValue = parsedDate.includes("T") ? parsedDate.split("T")[0] : parsedDate;
                            }

                            return (
                              <TableCell key={header}>
                                <Typography variant="body2">{String(displayValue)}</Typography>
                              </TableCell>
                            );
                          } catch {
                            return (
                              <TableCell key={header}>
                                <Typography variant="body2" color="error">
                                  Error
                                </Typography>
                              </TableCell>
                            );
                          }
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
                <CheckCircle sx={{ fontSize: 64, color: "success.main" }} />
                <Typography variant="h6">Import Complete!</Typography>
                <Link href="/dashboard/games">View Schedule</Link>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Chip icon={<CheckCircle />} label={`${importResult.success} Successful`} color="success" />
                  {importResult.failed > 0 && <Chip icon={<ErrorIcon />} label={`${importResult.failed} Failed`} color="error" />}
                  {(importResult.duplicates ?? 0) > 0 && <Chip label={`${importResult.duplicates} Duplicates Skipped`} color="warning" />}
                </Stack>

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
      </DialogContent>

      <DialogActions>
        {step === 0 && <Button onClick={onClose}>Cancel</Button>}

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

      {/* Date Required Modal */}
      <DateRequiredModal open={showDateRequiredModal} onClose={() => setShowDateRequiredModal(false)} />
    </Dialog>
  );
}
