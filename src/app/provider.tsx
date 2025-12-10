"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MUIThemeProvider } from "./theme-provider";
import { CsrfProvider } from "@/contexts/CsrfContext";
import { useState } from "react";

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
        <CsrfProvider>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </CsrfProvider>
      </SessionProvider>
    </MUIThemeProvider>
  );
}
