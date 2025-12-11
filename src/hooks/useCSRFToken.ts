import { useEffect, useState } from 'react';
import { getCSRFToken, clearCSRFToken, refreshCSRFToken } from '@/lib/security/csrf-client';

/**
 * React hook for managing CSRF tokens
 * Automatically fetches token on mount and provides refresh function
 * 
 * @example
 * const { token, isLoading, error, refresh } = useCSRFToken();
 * 
 * // Use in fetch requests
 * fetch('/api/games', {
 *   method: 'POST',
 *   headers: { 'x-csrf-token': token }
 * })
 */
export function useCSRFToken() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchToken = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const csrfToken = await getCSRFToken();
      setToken(csrfToken);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch CSRF token');
      setError(error);
      console.error('[useCSRFToken] Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refresh = async () => {
    setError(null);
    try {
      const newToken = await refreshCSRFToken();
      setToken(newToken);
      return newToken;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh CSRF token');
      setError(error);
      throw error;
    }
  };

  useEffect(() => {
    fetchToken();
    
    // Cleanup on unmount
    return () => {
      // Don't clear the token on unmount, it should persist across components
    };
  }, []);

  return {
    token,
    isLoading,
    error,
    refresh,
  };
}
