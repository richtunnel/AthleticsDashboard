import { useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export type AuthActionType = "google" | "azure-ad" | "credentials" | "navigation" | "custom";

interface UseAuthButtonOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  callbackUrl?: string;
}

interface AuthActionParams {
  type: AuthActionType;
  credentials?: {
    email: string;
    password: string;
  };
  navigationPath?: string;
  customAction?: () => Promise<void>;
}

export function useAuthButton(options: UseAuthButtonOptions = {}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const executeAction = useCallback(
    async (params: AuthActionParams) => {
      const { type, credentials, navigationPath, customAction } = params;
      const { onSuccess, onError, callbackUrl = "/dashboard" } = options;

      setLoading(true);

      try {
        switch (type) {
          case "google":
          case "azure-ad":
            // For OAuth providers, signIn redirects automatically
            await signIn(type, { callbackUrl });
            // If we reach here without redirect, keep loading state
            break;

          case "credentials":
            if (!credentials) {
              throw new Error("Credentials required for credential sign in");
            }
            const result = await signIn("credentials", {
              email: credentials.email,
              password: credentials.password,
              redirect: false,
            });

            if (result?.error) {
              throw new Error(result.error);
            }

            if (onSuccess) {
              onSuccess();
            } else {
              router.push(callbackUrl);
              router.refresh();
              // Reset loading after a short delay to handle cases where navigation doesn't unmount
              setTimeout(() => setLoading(false), 1000);
            }
            break;

          case "navigation":
            if (!navigationPath) {
              throw new Error("Navigation path required");
            }
            // Small delay to show loading state
            await new Promise((resolve) => setTimeout(resolve, 150));
            router.push(navigationPath);
            // Reset loading after a short delay to handle cases where navigation doesn't unmount
            setTimeout(() => setLoading(false), 1000);
            break;

          case "custom":
            if (!customAction) {
              throw new Error("Custom action required");
            }
            await customAction();
            if (onSuccess) {
              onSuccess();
            }
            break;

          default:
            throw new Error("Unknown auth action type");
        }
      } catch (error) {
        setLoading(false);
        if (onError) {
          onError(error instanceof Error ? error.message : "An unexpected error occurred");
        } else {
          console.error("Auth action error:", error);
        }
        throw error;
      }
    },
    [options, router]
  );

  const reset = useCallback(() => {
    setLoading(false);
  }, []);

  return {
    loading,
    executeAction,
    reset,
  };
}
