"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Box, Button, TextField, Typography, Alert, Chip, CircularProgress } from "@mui/material";
import { Google } from "@mui/icons-material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useState, Suspense } from "react";
import Divider from "@mui/material/Divider";
import BaseHeader from "@/components/headers/_base";
import { useAuthButton } from "@/lib/hooks/useAuthButton";
import { AuthActionButton } from "@/components/auth/AuthActionButton";

function SignupForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "free_trial_plan";
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const googleAuth = useAuthButton({
    callbackUrl: `/onboarding/setup?plan=${plan}`,
    onError: (err) => setError(err),
  });

  const azureAuth = useAuthButton({
    callbackUrl: `/onboarding/setup?plan=${plan}`,
    onError: (err) => setError(err),
  });

  const credentialsAuth = useAuthButton({
    callbackUrl: `/onboarding/setup?plan=${plan}`,
    onError: (err) => setError(err),
  });

  const isLoading = googleAuth.loading || azureAuth.loading || credentialsAuth.loading;

  const handleGoogleLogin = async () => {
    setError("");
    if (plan) {
      localStorage.setItem("onboarding_plan", plan);
    }
    try {
      await googleAuth.executeAction({ type: "google" });
    } catch (error) {
      // Error handled by onError callback
    }
  };

  const handleMicrosoftLogin = async () => {
    setError("");
    if (plan) {
      localStorage.setItem("onboarding_plan", plan);
    }
    try {
      await azureAuth.executeAction({ type: "azure-ad" });
    } catch (error) {
      // Error handled by onError callback
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

    try {
      const signupRes = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, plan, phone }),
      });

      if (!signupRes.ok) {
        const data = await signupRes.json().catch(() => null);
        setError(data?.error || "Failed to create user.");
        return;
      }
    } catch (error) {
      setError("Failed to create account. Please try again.");
      return;
    }

    if (plan) {
      localStorage.setItem("onboarding_plan", plan);
    }

    try {
      await credentialsAuth.executeAction({
        type: "credentials",
        credentials: {
          email,
          password,
        },
      });
    } catch (error) {
      if (plan) {
        localStorage.removeItem("onboarding_plan");
      }
      setError("Account created but login failed. Please login manually.");
      setTimeout(() => router.push("/login"), 2000);
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
        <AuthActionButton fullWidth variant="contained" startIcon={<Google />} onClick={handleGoogleLogin} loading={googleAuth.loading} disabled={isLoading} sx={{ mb: 1 }}>
          Sign up with Google
        </AuthActionButton>
        <AuthActionButton fullWidth variant="outlined" onClick={handleMicrosoftLogin} loading={azureAuth.loading} disabled={isLoading} sx={{ mb: 2 }}>
          Sign up with Microsoft
        </AuthActionButton>
        <Divider sx={{ my: 3 }}>OR</Divider>
        <Typography variant="h6" gutterBottom>
          Create account manually
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Create an account to get started automating your spreadsheets.
        </Typography>
        <form onSubmit={handleManualSignup}>
          <TextField fullWidth size="small" label="Full Name" required value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} sx={{ mb: 2 }} error={!!error && !name} />
          <TextField fullWidth size="small" label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} sx={{ mb: 2 }} error={!!error && !email} />
          <TextField fullWidth size="small" label="Phone (Optional)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isLoading} sx={{ mb: 2 }} />
          <TextField
            fullWidth
            size="small"
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            helperText="Must be at least 8 characters"
            sx={{ mb: 2 }}
            error={!!error && (!password || password.length < 8)}
          />
          <AuthActionButton fullWidth variant="contained" type="submit" loading={credentialsAuth.loading} disabled={isLoading || !name || !email || !password || password.length < 8}>
            Create Account
          </AuthActionButton>
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

function SignupPage() {
  return (
    <Suspense fallback={<Box sx={{ maxWidth: 400, mx: "auto", mt: 8 }}>Loading...</Box>}>
      <SignupForm />
    </Suspense>
  );
}

export default SignupPage;
