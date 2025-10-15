"use client";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Box, Button, TextField, Typography, Alert, Chip } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useState, Suspense } from "react";
import Divider from "@mui/material/Divider";
import BaseHeader from "@/components/headers/_base";

function SignupForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "free";

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleManualSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const signupRes = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!signupRes.ok) {
      const { error: signupError } = await signupRes.json();
      setError(signupError || "Failed to create user.");
      return;
    }

    // Sign in after successful creation
    const signInRes = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (signInRes?.error) {
      setError("Signup failed. Please try signing in.");
    } else {
      window.location.href = `/onboarding/start?plan=${plan}`;
    }
  };

  const handlePlanClick = () => {
    window.location.href = "/dashboard/onboarding/plans"; // Update with your actual plan page URL
  };

  return (
    <>
      <BaseHeader />

      <Box sx={{ maxWidth: 400, mx: "auto", mt: 8 }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <Chip
            icon={<DeleteIcon />}
            label={"Remove " + plan.charAt(0).toUpperCase() + plan.slice(1).replace("_", " ") + " "}
            onClick={handlePlanClick}
            clickable
            color="primary"
            variant="outlined"
            sx={{ fontWeight: "bold" }}
          />
        </Box>
        <Typography sx={{ textAlign: "center", fontWeight: "bold", paddingBottom: "10px" }} variant="h4" gutterBottom>
          Create an account to continue
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Button fullWidth variant="outlined" onClick={() => signIn("google", { callbackUrl: `/onboarding/start?plan=${plan}` })} sx={{ mb: 1 }}>
          Sign up with Google
        </Button>
        <Button fullWidth variant="outlined" onClick={() => signIn("azure-ad", { callbackUrl: `/onboarding/start?plan=${plan}` })} sx={{ mb: 1 }}>
          Sign up with Microsoft
        </Button>
        <Button fullWidth variant="outlined" onClick={() => signIn("facebook", { callbackUrl: `/onboarding/start?plan=${plan}` })} sx={{ mb: 2 }}>
          Sign up with Instagram (via Facebook)
        </Button>
        <br />
        <br />
        <Divider />
        <br />
        <Typography variant="h6" gutterBottom>
          Sign Up (manual)
        </Typography>
        <Typography sx={{ padding: "0px 0px 20px" }} variant="body2">
          {" "}
          Create your account and get started right away. Click on the trash icon to change plans.
        </Typography>
        <form onSubmit={handleManualSignup}>
          <TextField fullWidth size="small" label="Name" value={name} onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} sx={{ mb: 2 }} />
          <Button fullWidth variant="contained" type="submit">
            Create Account
          </Button>
        </form>
      </Box>
    </>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<Box sx={{ maxWidth: 400, mx: "auto", mt: 8 }}>Loading...</Box>}>
      <SignupForm />
    </Suspense>
  );
}
