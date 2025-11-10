"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MUIThemeProvider } from "./theme-provider";
import { useState } from "react";
import { MixpanelIdentifier } from "@/components/analytics/MixpanelIdentifier";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <MUIThemeProvider>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <MixpanelIdentifier />
          {children}
        </QueryClientProvider>
      </SessionProvider>
    </MUIThemeProvider>
  );
}
