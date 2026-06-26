"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Box, TextField, Typography, Link, Alert } from "@mui/material";
import styles from "@/styles/details_page.module.css";
import BaseHeader from "@/components/headers/_base";
import { AuthActionButton } from "@/components/auth/AuthActionButton";
import SchoolAddressAutocomplete from "@/components/forms/SchoolAddressAutocomplete";
import { MEMBER_ACCESS_EMAIL_PREFIX, MEMBER_ACCESS_EMAIL_DOMAIN } from "@/lib/utils/memberAccess";

/**
 * Resolve the Stripe checkout URL for the plan the user selected during signup.
 * planKey format from the plans page is `${plan.name}-${billing}` e.g.
 * "Team-monthly", "Team+ (Plus)-annual", "Free Trial (Standard)-monthly".
 * Returns the Stripe Checkout URL, or null if it couldn't be resolved (caller
 * then falls back to the plans page).
 */
async function resolveCheckoutUrl(planKey: string | null): Promise<string | null> {
  if (!planKey) return null;
  try {
    const lastDash = planKey.lastIndexOf("-");
    const name = (lastDash > 0 ? planKey.slice(0, lastDash) : planKey).toLowerCase();
    const billingRaw = lastDash > 0 ? planKey.slice(lastDash + 1).toLowerCase() : "monthly";
    const billing = billingRaw === "annual" ? "Annual" : "Monthly";

    // name → tier (check Plus before Team since "Team+ (Plus)" contains both)
    const tier = name.includes("plus") ? "plus" : name.includes("team") ? "team" : "standard";

    const config = await fetch("/api/stripe/config").then((r) => r.json());
    const priceId: string | undefined = config?.[`${tier}${billing}`];
    if (!priceId || !priceId.startsWith("price_")) return null;

    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId, isOnboarding: true }),
    });
    const data = await res.json().catch(() => null);
    return res.ok && data?.url ? (data.url as string) : null;
  } catch {
    return null;
  }
}

function DetailsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update } = useSession();
  const [schoolName, setSchoolName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.push("/onboarding/plans");
      return;
    }

    if (session?.user?.isOnboarded) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolName, teamName, schoolAddress, schoolEmail }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to update school details. Please try again.");
        setSubmitting(false);
        return;
      }

      await update();

      // Member access users skip plans/Stripe — go straight to the dashboard.
      const email = session?.user?.email ?? "";
      const isMember = email.startsWith(MEMBER_ACCESS_EMAIL_PREFIX) && email.endsWith(MEMBER_ACCESS_EMAIL_DOMAIN);
      if (isMember) {
        router.push("/dashboard");
        return;
      }

      // Normal flow: go to Stripe checkout for the plan selected during signup,
      // or fall back to the plans page.
      const checkoutUrl = await resolveCheckoutUrl(searchParams.get("plan"));
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      router.push("/onboarding/plans?checkout_required=true");
    } catch (err) {
      setError("An error occurred. Please try again.");
      setSubmitting(false);
    }
  };

  if (status === "loading" || (status === "authenticated" && session?.user?.isOnboarded)) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <>
      <BaseHeader pt={"20px"} pl={"20px"} />
      <div className={`${styles.detailsContainer}`}>
        <Box sx={{ maxWidth: 600, mx: "auto" }}>
          <Typography variant="h2" sx={{ fontWeight: "600", mb: 4, textAlign: "center" }} gutterBottom>
            Almost Done!
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: "600" }} gutterBottom>
            Enter School Details
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <form style={{ maxWidth: 400 }} onSubmit={handleSubmit}>
            <TextField size="small" fullWidth label="School Name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} sx={{ mb: 2 }} required disabled={submitting} />
            <TextField size="small" fullWidth label="Team Name" value={teamName} onChange={(e) => setTeamName(e.target.value)} sx={{ mb: 2 }} required disabled={submitting} />
            <TextField
              size="small"
              fullWidth
              label="School Email Address"
              type="email"
              value={schoolEmail}
              onChange={(e) => setSchoolEmail(e.target.value)}
              sx={{ mb: 2 }}
              placeholder="optional@school.edu"
              disabled={submitting}
            />
            <Box sx={{ mb: 2 }}>
              <SchoolAddressAutocomplete
                value={schoolAddress}
                onChange={(value) => setSchoolAddress(value)}
                label="School Address"
                placeholder="Start typing to search for your school address..."
                required
                disabled={submitting}
                size="small"
              />
            </Box>
            <AuthActionButton
              fullWidth
              variant="contained"
              type="submit"
              loading={submitting}
              disabled={submitting || schoolName.trim().length < 2 || teamName.trim().length < 2 || schoolAddress.trim().length < 5}
            >
              Complete Setup
            </AuthActionButton>
            <Typography variant="body2" sx={{ mt: 2, textAlign: "center" }}>
              By clicking "Complete Setup", you agree to our{" "}
              <Link href="/terms" underline="hover">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" underline="hover">
                Privacy Policy
              </Link>
              .
            </Typography>
          </form>
        </Box>
      </div>
    </>
  );
}

export default function DetailsPage() {
  return (
    <Suspense fallback={null}>
      <DetailsPageInner />
    </Suspense>
  );
}
