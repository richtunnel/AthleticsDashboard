"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "next-auth/react";
import { Box, Button, TextField, Typography, Select, MenuItem, Alert, CircularProgress } from "@mui/material";
import Papa from "papaparse"; // For CSV parsing
import { ImportGroupsButton } from "@/components/communication/email/ImportGroupButtonG";
interface EmailGroup {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  emails: { email: string }[];
}

export default function EmailGroupsPage() {
  const router = useRouter();
  const [newGroupName, setNewGroupName] = useState("");
  const [groups, setGroups] = useState<EmailGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) router.push("/login");

      const res = await fetch("/api/email/groups");
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
      setLoading(false);
    })();
  }, [router]);

  const handleCreateGroup = async () => {
    setError("");
    const res = await fetch("/api/email/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName }),
    });
    if (res.ok) {
      const newGroup = await res.json();
      setGroups([...groups, newGroup]);
      setNewGroupName("");
    } else {
      setError("Failed to create group");
    }
  };

  const handleFileChange = (e: any) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file || !selectedGroup) {
      setError("Select a group and file");
      return;
    }

    setUploadLoading(true);
    setError("");

    Papa.parse<string[]>(file, {
      complete: async (results) => {
        const emails = results.data.flat().filter((email): email is string => typeof email === "string" && email.includes("@")); // Type guard
        if (emails.length === 0) {
          setError("No valid emails in CSV");
          setUploadLoading(false);
          return;
        }

        const res = await fetch("/api/email/groups/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId: selectedGroup, emails }),
        });

        if (res.ok) {
          alert("Emails uploaded successfully");
          setFile(null);
          // Refresh groups to update email counts
          const groupsRes = await fetch("/api/email/groups");
          if (groupsRes.ok) {
            setGroups(await groupsRes.json());
          }
        } else {
          setError("Upload failed");
        }
        setUploadLoading(false);
      },
      header: false,
    });
  };

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <Box sx={{ maxWidth: 600, mt: 4 }}>
      <Typography sx={{ mb: 1 }} variant="h5">
        Create Email Campaigns
      </Typography>
      <Typography sx={{ marginBottom: "1rem" }} gutterBottom>
        Save time by uploading your email contacts into our campaign manager allowing you to group and send bulk emails and updates with the click of a button.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="body1">Import from Google</Typography>
      {/* <ImportGroupsButton /> */}

      <Typography variant="caption">Name of campaign</Typography>
      <TextField fullWidth label="New Group Name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} sx={{ mb: 2 }} />
      <Button variant="contained" onClick={handleCreateGroup} sx={{ mb: 4 }}>
        Create Group
      </Button>
      <Typography variant="h6" gutterBottom>
        Upload Bulk Emails (CSV)
      </Typography>
      <Select size="small" fullWidth value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} displayEmpty sx={{ mb: 2 }}>
        <MenuItem value="" disabled>
          Select Group
        </MenuItem>
        {groups.map((group: any) => (
          <MenuItem key={group.id} value={group.id}>
            {group.name}
          </MenuItem>
        ))}
      </Select>
      <input type="file" accept=".csv" onChange={handleFileChange} />
      <Button variant="contained" onClick={handleUpload} disabled={uploadLoading} sx={{ mt: 2 }}>
        {uploadLoading ? <CircularProgress size={24} /> : "Upload CSV"}
      </Button>
    </Box>
  );
}
