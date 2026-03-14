import ParentSessionProvider from "@/components/providers/ParentSessionProvider";

/**
 * Layout for the parent callback page.
 *
 * Wraps in ParentSessionProvider so that getSession() reads the parent cookie
 * and API calls use the parent session.
 */
export default function ParentCallbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ParentSessionProvider>{children}</ParentSessionProvider>;
}
