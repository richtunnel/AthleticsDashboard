"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Box, Button, TextField, Typography, Alert, Chip, CircularProgress } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { Google } from "@mui/icons-material";
import { useState, Suspense } from "react";
import Divider from "@mui/material/Divider";
import BaseHeader from "@/components/headers/_base";

function SignupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const plan = searchParams.get("plan") || "free_trial_plan";

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleManualSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name || !email || !password) {
      setError("All fields are required");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, plan }),
      });

      const data = await signupRes.json();

      if (!signupRes.ok) {
        setError(data.error || "Failed to create user.");
        setLoading(false);
        return;
      }

      // Sign in after successful creation
      const signInRes = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (signInRes?.error) {
        setError("Account created but login failed. Please login manually.");
        setLoading(false);
        setTimeout(() => router.push("/login"), 2000);
        return;
      }

      router.push(`/onboarding/setup?plan=${plan}`);
      router.refresh();
    } catch (error) {
      console.error("Signup error:", error);
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setError("");

    // Store plan in localStorage to retrieve after OAuth redirect
    if (plan) {
      localStorage.setItem('onboarding_plan', plan);
    }

    // For Google OAuth, signup and login are the same flow
    // NextAuth will create account if it doesn't exist
    signIn("google", {
      callbackUrl: `/onboarding/setup?plan=${plan}`,
    });
  };

  const handlePlanClick = () => {
    window.location.href = "/onboarding/plans"; // Update with your actual plan page URL
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
        <Button 
          fullWidth 
          variant="contained" 
          startIcon={<Google />} 
          onClick={handleGoogleSignup} 
          disabled={loading || googleLoading} 
          sx={{ mb: 1 }}
        >
          {googleLoading ? <CircularProgress size={24} /> : "Sign up with Google"}
        </Button>
        <Button fullWidth variant="outlined" onClick={() => signIn("azure-ad", { callbackUrl: `/onboarding/setup?plan=${plan}` })} sx={{ mb: 1 }}>
          Sign up with Microsoft
        </Button>
        <Button fullWidth variant="outlined" onClick={() => signIn("facebook", { callbackUrl: `/onboarding/setup?plan=${plan}` })} sx={{ mb: 2 }}>
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
          <TextField 
            fullWidth 
            size="small" 
            label="Full Name" 
            required
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            disabled={loading}
            sx={{ mb: 2 }} 
          />
          <TextField 
            fullWidth 
            size="small" 
            label="Email" 
            type="email"
            required
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            disabled={loading}
            sx={{ mb: 2 }} 
          />
          <TextField 
            fullWidth 
            size="small" 
            label="Phone" 
            type="tel" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
            disabled={loading}
            sx={{ mb: 2 }} 
          />
          <TextField 
            fullWidth 
            size="small" 
            label="Password" 
            type="password" 
            required
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            disabled={loading}
            helperText="Must be at least 8 characters"
            sx={{ mb: 2 }} 
          />
          <Button fullWidth variant="contained" type="submit" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : "Create Account"}
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
