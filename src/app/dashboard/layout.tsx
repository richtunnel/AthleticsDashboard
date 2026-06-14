import type { Metadata } from "next";
import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/utils/authOptions";
import { checkPaymentStatus } from "@/lib/services/payment-status.service";
import DashboardLayoutClient from "./DashboardLayoutClient";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  // ── Gate 1: school details ────────────────────────────────────────────────
  // No AD reaches the dashboard without completing onboarding details.
  if (!session.user.isOnboarded) {
    redirect("/onboarding/details");
  }

  // ── Gate 2: Stripe checkout (server-side, defense-in-depth) ───────────────
  // The middleware already enforces this, but a server-rendered guard here means
  // NO user/bot/AI can reach the dashboard without completing checkout even if
  // the middleware is somehow bypassed. A brand-new AD with no subscription is
  // sent to /onboarding/plans (not under /dashboard, so no redirect loop).
  // Skipped in dev unless FORCE_PAYMENT_GATE=true, matching the middleware so
  // local development isn't blocked. checkPaymentStatus already exempts
  // SUPER_ADMIN and member-access accounts (needsCheckout stays false for them).
  const enforcePayment =
    process.env.NODE_ENV === "production" || process.env.FORCE_PAYMENT_GATE === "true";

  if (enforcePayment) {
    let needsCheckout = false;
    try {
      const pay = await checkPaymentStatus(session.user.id);
      needsCheckout = Boolean(pay.needsCheckout);
    } catch (err) {
      // A hard DB error shouldn't lock every user out of the whole app; the
      // middleware still guards. Log and let this render fall through.
      console.error("[DashboardLayout] payment guard error:", err);
    }
    if (needsCheckout) {
      redirect("/onboarding/plans?checkout_required=true");
    }
  }

  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
