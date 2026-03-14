import ParentSessionProvider from "@/components/providers/ParentSessionProvider";

/**
 * Layout for parent onboarding pages.
 *
 * Wraps children in ParentSessionProvider so that useSession() and signIn()
 * use the parent auth endpoint (/api/auth/parent) with its own cookie.
 * This allows a parent to go through onboarding while an AD is logged in
 * on the same browser.
 */
export default function ParentOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ParentSessionProvider>{children}</ParentSessionProvider>;
}
