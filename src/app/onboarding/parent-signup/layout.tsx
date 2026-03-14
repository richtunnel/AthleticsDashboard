import ParentSessionProvider from "@/components/providers/ParentSessionProvider";

/**
 * Layout for the parent signup page.
 *
 * Wraps in ParentSessionProvider so that signIn("google") routes to
 * /api/auth/parent/signin/google and creates a separate parent cookie.
 */
export default function ParentSignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ParentSessionProvider>{children}</ParentSessionProvider>;
}
