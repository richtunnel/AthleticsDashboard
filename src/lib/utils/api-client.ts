/**
 * Enhanced fetch wrapper that automatically includes CSRF token
 * Use this for all state-changing API requests (POST, PUT, PATCH, DELETE)
 */

let csrfToken: string | null = null;

/**
 * Set the CSRF token (called by CsrfProvider)
 */
export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

/**
 * Get the current CSRF token
 */
export function getCsrfToken(): string | null {
  return csrfToken;
}

interface FetchOptions extends RequestInit {
  skipCsrf?: boolean;
}

/**
 * Fetch wrapper that automatically includes CSRF token for state-changing requests
 */
export async function fetchWithCsrf(url: string, options: FetchOptions = {}): Promise<Response> {
  const { skipCsrf, ...fetchOptions } = options;
  const method = fetchOptions.method?.toUpperCase() || "GET";
  
  // For state-changing methods, add CSRF token
  if (!skipCsrf && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const token = getCsrfToken();
    
    if (token) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        "X-CSRF-Token": token,
      };
    } else {
      console.warn("[API Client] CSRF token not available for", method, url);
    }
  }
  
  return fetch(url, fetchOptions);
}

/**
 * Helper function for JSON API requests with CSRF protection
 */
export async function apiRequest<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const response = await fetchWithCsrf(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }
  
  return response.json();
}
