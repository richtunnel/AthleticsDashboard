/**
 * Normalizes a URL to be browser-compatible by replacing 0.0.0.0 with localhost.
 * 
 * This is necessary because while 0.0.0.0 is a valid address for server binding
 * (meaning "bind to all network interfaces"), browsers cannot navigate to it.
 * 
 * @param url - The URL to normalize
 * @returns The normalized URL with localhost instead of 0.0.0.0
 * 
 * @example
 * normalizeBrowserUrl("http://0.0.0.0:3000/api/test")
 * // Returns: "http://localhost:3000/api/test"
 */
export function normalizeBrowserUrl(url: string): string {
  return url.replace("://0.0.0.0", "://localhost");
}
