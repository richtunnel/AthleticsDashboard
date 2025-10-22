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
  InputLabel,
  Stack,
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";
import { CloudUpload, Close, CheckCircle, Error as ErrorIcon, Download, Visibility, Warning } from "@mui/icons-material";
import Link from "next/link";

interface CSVImportProps {
  onImportComplete?: (result: ImportResult) => void;
  onClose?: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

interface ParsedRow {
  [key: string]: string | number | null;
}

interface FieldMapping {
  [csvField: string]: string; // Maps CSV column to database field
}

const DATABASE_FIELDS = [
  { value: "date", label: "Date", required: true },
  { value: "time", label: "Time", required: false },
  { value: "sport", label: "Sport", required: true },
  { value: "level", label: "Level", required: true },
  { value: "opponent", label: "Opponent", required: false },
  { value: "isHome", label: "Home/Away", required: true },
  { value: "venue", label: "Venue", required: false },
  { value: "status", label: "Status", required: false },
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

  // Auto-map common field names
  const autoMapFields = (csvHeaders: string[]): FieldMapping => {
    const mapping: FieldMapping = {};

    csvHeaders.forEach((header) => {
      const normalized = header.toLowerCase().trim();

      if (normalized.includes("date")) mapping[header] = "date";
      else if (normalized.includes("time")) mapping[header] = "time";
      else if (normalized.includes("sport")) mapping[header] = "sport";
      else if (normalized.includes("level") || normalized.includes("grade")) mapping[header] = "level";
      else if (normalized.includes("opponent") || normalized.includes("vs")) mapping[header] = "opponent";
      else if (normalized.includes("home") || normalized.includes("away") || normalized.includes("location")) mapping[header] = "isHome";
      else if (normalized.includes("venue") || normalized.includes("site")) mapping[header] = "venue";
      else if (normalized.includes("status")) mapping[header] = "status";
      else if (normalized.includes("note")) mapping[header] = "notes";
      else mapping[header] = "skip";
    });

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

  // Transform CSV data to game format
  const transformData = (row: ParsedRow): any => {
    const transformed: any = {};

    Object.keys(fieldMapping).forEach((csvField) => {
      const dbField = fieldMapping[csvField];
      if (dbField === "skip") return;

      let value = row[csvField];

      // Transform specific fields
      switch (dbField) {
        case "date":
          transformed.date = value ? new Date(value as string).toISOString() : null;
          break;
        case "isHome":
          const normalized = String(value).toLowerCase().trim();
          transformed.isHome = normalized === "home" || normalized === "h" || normalized === "yes";
          break;
        case "status":
          const statusMap: any = {
            scheduled: "SCHEDULED",
            confirmed: "CONFIRMED",
            cancelled: "CANCELLED",
            postponed: "POSTPONED",
            completed: "COMPLETED",
          };
          transformed.status = statusMap[String(value).toLowerCase()] || "SCHEDULED";
          break;
        default:
          transformed[dbField] = value || null;
      }
    });

    return transformed;
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

    try {
      for (let i = 0; i < totalBatches; i++) {
        const batch = parsedData.slice(i * batchSize, (i + 1) * batchSize);
        const transformedBatch = batch.map(transformData);

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
        } else {
          failedCount += batch.length;
          errors.push(`Batch ${i + 1} failed: ${result.error}`);
        }

        // Update progress
        setImportProgress(((i + 1) / totalBatches) * 100);
      }

      const finalResult: ImportResult = {
        success: successCount,
        failed: failedCount,
        errors,
      };

      setImportResult(finalResult);
      onImportComplete?.(finalResult);
    } catch (error) {
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
    const headers = ["date", "time", "sport", "level", "opponent", "location", "venue", "status", "notes"];
    const sampleData = [
      ["2024-01-15", "15:00", "Basketball", "VARSITY", "Lincoln High", "Home", "", "CONFIRMED", "Senior Night"],
      ["2024-01-20", "18:30", "Football", "JV", "Roosevelt HS", "Away", "Roosevelt Stadium", "SCHEDULED", ""],
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
                <CheckCircle sx={{ fontSize: 64, color: "success.main" }} />
                <Typography variant="h6">Import Complete!</Typography>
                <Link href="/dashboard/games">View Schedule</Link>
                <Stack direction="row" spacing={2}>
                  <Chip icon={<CheckCircle />} label={`${importResult.success} Successful`} color="success" />
                  {importResult.failed > 0 && <Chip icon={<ErrorIcon />} label={`${importResult.failed} Failed`} color="error" />}
                </Stack>

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
            <Button variant="contained" onClick={onClose}>
              Close
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
