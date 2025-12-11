/**
 * Client-side CSRF token management
 * Fetches and caches CSRF token for protected API requests
 */

let csrfToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

/**
 * Fetches a fresh CSRF token from the server
 */
async function fetchCSRFToken(): Promise<string> {
  try {
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include', // Important: include cookies
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('[CSRF Client] Error fetching token:', error);
    throw error;
  }
}

/**
 * Gets the current CSRF token, fetching a new one if needed
 * Multiple simultaneous calls will share the same promise
 */
export async function getCSRFToken(): Promise<string> {
  // Return cached token if available
  if (csrfToken) {
    return csrfToken;
  }
  
  // If a fetch is already in progress, wait for it
  if (tokenPromise) {
    return tokenPromise;
  }
  
  // Fetch a new token
  tokenPromise = fetchCSRFToken();
  
  try {
    csrfToken = await tokenPromise;
    return csrfToken;
  } finally {
    tokenPromise = null;
  }
}

/**
 * Clears the cached CSRF token (useful after errors or logout)
 */
export function clearCSRFToken(): void {
  csrfToken = null;
  tokenPromise = null;
}

/**
 * Refreshes the CSRF token (fetches a new one)
 */
export async function refreshCSRFToken(): Promise<string> {
  clearCSRFToken();
  return getCSRFToken();
}

/**
 * Makes a protected fetch request with CSRF token included
 * 
 * @example
 * const response = await protectedFetch('/api/games', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'Game 1' })
 * });
 */
export async function protectedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Skip CSRF token for safe methods
  const method = options.method?.toUpperCase() || 'GET';
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return fetch(url, options);
  }
  
  // Get CSRF token
  let token: string;
  try {
    token = await getCSRFToken();
  } catch (error) {
    console.error('[CSRF Client] Failed to get token, proceeding without it:', error);
    return fetch(url, options);
  }
  
  // Add CSRF token to headers
  const headers = new Headers(options.headers);
  headers.set('x-csrf-token', token);
  
  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: options.credentials || 'include', // Include cookies
  });
  
  // If we get a 403, the token might be invalid - try refreshing once
  if (response.status === 403) {
    const errorBody = await response.clone().json().catch(() => ({}));
    
    if (errorBody.error?.toLowerCase().includes('csrf')) {
      console.warn('[CSRF Client] Got 403 CSRF error, refreshing token and retrying...');
      
      try {
        token = await refreshCSRFToken();
        headers.set('x-csrf-token', token);
        
        return fetch(url, {
          ...options,
          headers,
          credentials: options.credentials || 'include',
        });
      } catch (retryError) {
        console.error('[CSRF Client] Retry failed:', retryError);
      }
    }
  }
  
  return response;
}
