/**
 * Extracts the first name from a full name string
 * @param fullName - The full name string (e.g., "John Doe")
 * @returns The first name only (e.g., "John")
 */
export function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  
  const parts = trimmed.split(/\s+/);
  return parts[0];
}
