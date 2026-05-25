/**
 * Shared text-formatting helpers. Keep these tiny and dependency-free so they
 * can be imported anywhere (server routes, client components, workers).
 */

/**
 * Title-case a string while preserving common all-caps acronyms.
 *
 * Examples:
 *   titleCase("test organization")         → "Test Organization"
 *   titleCase("NYC public schools")        → "NYC Public Schools"
 *   titleCase("FCBA  academy")             → "FCBA Academy"
 *   titleCase("o'connor high")             → "O'Connor High"
 *   titleCase("st. mary's")                → "St. Mary's"
 *
 * Words already in ALL CAPS with ≥2 letters are left untouched (acronyms).
 * Apostrophes, hyphens, and dots are preserved.
 */
export function titleCase(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .trim()
    .replace(/\s+/g, " ") // collapse runs of whitespace
    .split(" ")
    .map((word) => {
      if (!word) return word;
      // Preserve acronyms like "USA", "NYC", "K-12"
      if (word.length >= 2 && word === word.toUpperCase() && /[A-Z]/.test(word)) {
        return word;
      }
      // Split on apostrophes/hyphens so each segment gets capitalised:
      // "o'connor" → "O'Connor", "st-mary" → "St-Mary"
      return word.replace(
        /([^\s'-]+)/g,
        (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
      );
    })
    .join(" ");
}

/**
 * Title-case an organization / school name. Thin alias over titleCase so the
 * intent is clear at call sites and we can tweak org-specific rules later
 * (e.g. force certain abbreviations) without touching every page.
 */
export const formatOrgName = (name: string | null | undefined): string => titleCase(name);
