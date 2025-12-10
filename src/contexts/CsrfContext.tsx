"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { setCsrfToken } from "@/lib/utils/api-client";

interface CsrfContextType {
  token: string | null;
  refreshToken: () => Promise<void>;
  isLoading: boolean;
}

const CsrfContext = createContext<CsrfContextType>({
  token: null,
  refreshToken: async () => {},
  isLoading: true,
});

export function useCsrf() {
  return useContext(CsrfContext);
}

/**
 * Fetches a new CSRF token from the server
 */
async function fetchCsrfToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/csrf-token");
    
    if (!response.ok) {
      console.error("[CSRF] Failed to fetch token:", response.status);
      return null;
    }
    
    const data = await response.json();
    return data.token || null;
  } catch (error) {
    console.error("[CSRF] Error fetching token:", error);
    return null;
  }
}

export function CsrfProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshToken = async () => {
    if (status !== "authenticated") {
      setToken(null);
      setCsrfToken(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const newToken = await fetchCsrfToken();
    setToken(newToken);
    setCsrfToken(newToken);
    setIsLoading(false);
  };

  // Fetch token when session is available
  useEffect(() => {
    if (status === "authenticated") {
      refreshToken();
    } else if (status === "unauthenticated") {
      setToken(null);
      setIsLoading(false);
    }
  }, [status]);

  // Refresh token periodically (every 30 minutes)
  useEffect(() => {
    if (status === "authenticated" && token) {
      const interval = setInterval(() => {
        refreshToken();
      }, 30 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [status, token]);

  return (
    <CsrfContext.Provider value={{ token, refreshToken, isLoading }}>
      {children}
    </CsrfContext.Provider>
  );
}
