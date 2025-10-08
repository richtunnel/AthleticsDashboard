"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Upload, FileSpreadsheet } from "lucide-react";

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/export/games");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `games-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export games");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition disabled:opacity-50">
      {isExporting ? <FileSpreadsheet size={18} className="animate-pulse" /> : <Download size={18} />}
      Export to CSV
    </button>
  );
}

export function ImportButton() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/games", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Import failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      alert(`Import complete!\nSuccess: ${data.data.success}\nErrors: ${data.data.errors.length}`);
      setFile(null);
    },
    onError: () => {
      alert("Import failed. Please check your CSV format.");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = () => {
    if (file) {
      mutation.mutate(file);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="csv-upload" />
      <label htmlFor="csv-upload" className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition cursor-pointer">
        <Upload size={18} />
        {file ? file.name : "Choose CSV File"}
      </label>
      {file && (
        <button onClick={handleImport} disabled={mutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
          {mutation.isPending ? "Importing..." : "Import"}
        </button>
      )}
    </div>
  );
}
