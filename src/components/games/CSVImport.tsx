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

interface CSVImportProps {
  onImportComplete?: (result: ImportResult) => void;
  onClose?: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  warnings: string[];
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
  { value: "sport", label: "Sport", required: false },
  { value: "level", label: "Level", required: false },
  { value: "isHome", label: "Home/Away", required: false },
  { value: "opponent", label: "Opponent", required: false },
  { value: "away", label: "Away Team (for auto-detection)", required: false },
  { value: "location", label: "Location or Venue", required: false },
  { value: "time", label: "Time", required: false },
  { value: "status", label: "Confirmed", required: false },
  { value: "busTravel", label: "Bus Travel", required: false },
  { value: "notes", label: "Notes", required: false },
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

  // Auto-map common field names
  const autoMapFields = (csvHeaders: string[]): FieldMapping => {
    const mapping: FieldMapping = {};

    csvHeaders.forEach((header) => {
      const normalized = header.toLowerCase().trim();

      // Date mapping
      if (normalized.includes("date")) {
        mapping[header] = "date";
      }
      // Time mapping (but not if it's part of "location")
      else if (normalized.includes("time") && !normalized.includes("location")) {
        mapping[header] = "time";
      }
      // Sport mapping
      else if (normalized.includes("sport")) {
        mapping[header] = "sport";
      }
      // Level mapping
      else if (normalized.includes("level") || normalized.includes("grade")) {
        mapping[header] = "level";
      }
      // Bus Travel mapping - check for travel-related terms
      else if (
        normalized.includes("travel") ||
        normalized.includes("bus") ||
        normalized.includes("departure") ||
        normalized.includes("commute")
      ) {
        mapping[header] = "busTravel";
      }
      // Away column - check if data contains "Away" or "Home" values OR team names
      else if (normalized.includes("away")) {
        // Check sample data to determine if it's home/away or team names
        const sampleValues = parsedData.slice(0, 10).map(row => 
          String(row[header] || "").toLowerCase().trim()
        );
        const hasHomeAwayData = sampleValues.some(val => 
          val === "home" || val === "away" || val === "h" || val === "a"
        );
        
        if (hasHomeAwayData) {
          // Column contains "Home"/"Away" values → map to Home/Away field
          mapping[header] = "isHome";
        } else {
          // Column contains team names → map to Away field for smart detection
          mapping[header] = "away";
        }
      }
      // Opponent mapping
      else if (normalized.includes("opponent") || normalized.includes("vs")) {
        mapping[header] = "opponent";
      }
      // Home/Away mapping
      else if (normalized.includes("home")) {
        mapping[header] = "isHome";
      }
      // Location/Venue mapping
      else if (
        normalized === "location" || 
        normalized.includes("venue") || 
        normalized.includes("site") ||
        normalized.includes("game location")
      ) {
        mapping[header] = "location";
      }
      // Confirmed/Status mapping
      else if (normalized.includes("status") || normalized.includes("confirm")) {
        mapping[header] = "status";
      }
      // Notes mapping
      else if (normalized.includes("note")) {
        mapping[header] = "notes";
      }
      // Default to skip
      else {
        mapping[header] = "skip";
      }
    });

    return mapping;
  };

  // Validate mapped data
  const validateData = (): boolean => {
    const errors: string[] = [];
    const warnings: string[] = [];

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
              result.warnings.forEach(warning => {
                warnings.push(`Row ${i + 2}: ${warning}`);
              });
            }
          } catch (error) {
            errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Invalid date'}`);
          }
        }
      }
    }
    
    // Validate all rows for time issues (if time field is mapped)
    const timeField = Object.keys(fieldMapping).find((k) => fieldMapping[k] === "time");
    if (timeField) {
      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        if (row[timeField]) {
          try {
            const timeValue = row[timeField];
            // Try to parse the time using our robust parser with warnings
            const result = parseAndConvertTime(timeValue as string | number, true);
            if (result.warnings.length > 0) {
              result.warnings.forEach(warning => {
                warnings.push(`Row ${i + 2}: ${warning}`);
              });
            }
          } catch (error) {
            errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Invalid time'}`);
          }
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

  // Transform CSV data to game format
  const transformData = (row: ParsedRow, rowIndex?: number): Record<string, string | boolean | null> => {
    try {
      const transformed: Record<string, string | boolean | null> = {
        // Set defaults for optional fields
        isHome: true, // Default to home game
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
              const errorMsg = error instanceof Error ? error.message : 'Invalid date';
              throw new Error(`Invalid date in column "${csvField}": ${errorMsg}`);
            }
            break;
          case "time":
            try {
              transformed.time = value ? parseAndConvertTime(value as string | number) : null;
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Invalid time';
              throw new Error(`Invalid time in column "${csvField}": ${errorMsg}`);
            }
            break;
          case "isHome":
            if (value) {
              const normalized = String(value).toLowerCase().trim();
              transformed.isHome = normalized === "home" || normalized === "h" || normalized === "yes" || normalized === "true";
            }
            break;
          case "status":
            if (value) {
              const normalized = String(value).toLowerCase().trim();
              const statusMap: Record<string, string> = {
                scheduled: "SCHEDULED",
                confirmed: "CONFIRMED",
                cancelled: "CANCELLED",
                postponed: "POSTPONED",
                completed: "COMPLETED",
                // Handle boolean-like values for "Confirmed" columns
                yes: "CONFIRMED",
                true: "CONFIRMED",
                "1": "CONFIRMED",
                no: "SCHEDULED",
                false: "SCHEDULED",
                "0": "SCHEDULED",
              };
              transformed.status = statusMap[normalized] || "SCHEDULED";
            } else {
              transformed.status = "SCHEDULED";
            }
            break;
          case "busTravel":
            if (value !== null && value !== undefined) {
              const normalized = String(value).toLowerCase().trim();
              transformed.busTravel = 
                normalized === "yes" || 
                normalized === "true" || 
                normalized === "1" ||
                normalized === "y";
            } else {
              transformed.busTravel = false;
            }
            break;
          default:
            transformed[dbField] = value ? String(value) : null;
        }
      });

      return transformed;
    } catch (error) {
      const rowNum = rowIndex !== undefined ? ` (Row ${rowIndex + 2})` : '';
      throw new Error(`Transform error${rowNum}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    const errors: string[] = [];
    const warnings: string[] = [];
    const allCreatedGameIds: string[] = [];

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
            errors.push(`Row ${rowNum}: ${error instanceof Error ? error.message : 'Transform failed'}`);
          }
        });

        // Only send batch if there are valid rows
        if (transformedBatch.length > 0) {
          try {
            // Send batch to API
            const response = await fetch("/api/import/games/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ games: transformedBatch }),
            });

            const result = await response.json();

            if (result.success) {
              successCount += result.data.success || 0;
              failedCount += result.data.failed || 0;
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
            errors.push(`Batch ${i + 1} network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
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
              <Button startIcon={<Download />} onClick={handleDownloadTemplate} variant="outlined">
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
            <Alert severity="info">Map your CSV columns to the database fields. Required fields are marked with *.</Alert>

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
                          try {
                            const transformed = transformData(row, idx);
                            let displayValue = transformed[dbField] || "—";
                            
                            // Format date field to show only date part (not time/timezone)
                            if (dbField === "date" && displayValue !== "—" && typeof displayValue === "string") {
                              // Extract YYYY-MM-DD from ISO string
                              displayValue = displayValue.includes("T") 
                                ? displayValue.split("T")[0] 
                                : displayValue;
                            }
                            
                            return (
                              <TableCell key={csvField}>
                                <Typography variant="body2">{String(displayValue)}</Typography>
                              </TableCell>
                            );
                          } catch {
                            return (
                              <TableCell key={csvField}>
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
                <Stack direction="row" spacing={2}>
                  <Chip icon={<CheckCircle />} label={`${importResult.success} Successful`} color="success" />
                  {importResult.failed > 0 && <Chip icon={<ErrorIcon />} label={`${importResult.failed} Failed`} color="error" />}
                </Stack>

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
    </Dialog>
  );
}
