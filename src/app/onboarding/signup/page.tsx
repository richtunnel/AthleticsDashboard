"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Box, Button, TextField, Typography, Alert, Chip, CircularProgress } from "@mui/material";
import { Google } from "@mui/icons-material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useState, Suspense } from "react";
import Divider from "@mui/material/Divider";
import BaseHeader from "@/components/headers/_base";

export function SignupForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "free_trial_plan";
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      setError("");

      if (plan) {
        localStorage.setItem("onboarding_plan", plan);
      }

      await signIn("google", {
        callbackUrl: `/onboarding/setup?plan=${plan}`,
      });
    } catch (error) {
      console.error("Google signup error:", error);
      setError("Failed to sign up with Google");
      setGoogleLoading(false);
    }
  };

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
        body: JSON.stringify({ name, email, password, plan, phone }),
      });

      const data = await signupRes.json();

      if (!signupRes.ok) {
        setError(data.error || "Failed to create user.");
        setLoading(false);
        return;
      }

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
    } catch (error) {
      console.error("Signup error:", error);
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  const handlePlanClick = () => {
    router.push("/dashboard/onboarding/plans");
  };

  return (
    <>
      <BaseHeader pt="20px" pl="20px" />
      <Box sx={{ maxWidth: 400, mx: "auto", mt: 8, p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <Chip
            icon={<DeleteIcon />}
            label={plan.charAt(0).toUpperCase() + plan.slice(1).replace("_", " ")}
            onClick={handlePlanClick}
            clickable
            color="primary"
            variant="outlined"
            sx={{ fontWeight: "bold" }}
          />
        </Box>
        <Typography sx={{ textAlign: "center", fontWeight: "bold", mb: 2 }} variant="h4">
          Create an account
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Button fullWidth variant="contained" startIcon={<Google />} onClick={handleGoogleLogin} disabled={loading || googleLoading} sx={{ mb: 1 }}>
          {googleLoading ? <CircularProgress size={24} /> : "Sign up with Google"}
        </Button>
        <Button fullWidth variant="outlined" onClick={() => signIn("azure-ad", { callbackUrl: `/onboarding/setup?plan=${plan}` })} disabled={loading} sx={{ mb: 2 }}>
          Sign up with Microsoft
        </Button>
        <Divider sx={{ my: 3 }}>OR</Divider>
        <Typography variant="h6" gutterBottom>
          Create account manually
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Create an account to get started automating your spreadsheets.
        </Typography>
        <form onSubmit={handleManualSignup}>
          <TextField fullWidth size="small" label="Full Name" required value={name} onChange={(e) => setName(e.target.value)} disabled={loading} sx={{ mb: 2 }} error={!!error && !name} />
          <TextField fullWidth size="small" label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} sx={{ mb: 2 }} error={!!error && !email} />
          <TextField fullWidth size="small" label="Phone (Optional)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} sx={{ mb: 2 }} />
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
            error={!!error && (!password || password.length < 8)}
          />
          <Button fullWidth variant="contained" type="submit" disabled={loading || !name || !email || !password || password.length < 8}>
            {loading ? <CircularProgress size={24} /> : "Create Account"}
          </Button>
        </form>
        <Typography variant="body2" sx={{ mt: 2, textAlign: "center" }}>
          Already have an account?{" "}
          <Button variant="text" onClick={() => router.push("/login")}>
            Sign in
          </Button>
        </Typography>
      </Box>
    </>
  );
}

export default function SignUpPlan() {
  return (
    <Suspense fallback={<Box sx={{ maxWidth: 400, mx: "auto", mt: 8 }}>Loading...</Box>}>
      <SignupForm />
    </Suspense>
  );
}
