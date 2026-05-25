/**
 * Typed localStorage contract for the parent onboarding pipeline.
 *
 * All reads and writes go through this module. Nothing else should call
 * localStorage.getItem/setItem with the "parentOnboardingPrefs" key directly.
 *
 * The module enforces three invariants:
 *   1. Required fields are NEVER undefined or empty at write time.
 *   2. Reads coerce legacy/missing fields and return null (not bad data) on failure.
 *   3. Clearing always happens through clearOnboardingPrefs() so the key is consistent.
 */

const STORAGE_KEY = "parentOnboardingPrefs";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Canonical shape stored in localStorage during parent onboarding.
 * All non-optional fields are guaranteed non-empty strings after a successful
 * save or read.
 */
export interface ParentOnboardingPrefs {
  // ── Step 1: Child info ──────────────────────────────────────────────────────
  childName: string;
  schoolId: string;
  schoolName: string;
  athleticDirectorId: string;   // may be "" if school has none
  athleticDirectorName: string; // may be "" if school has none
  // ── Step 1: Sport selection ─────────────────────────────────────────────────
  sportId: string;
  /**
   * Raw sport name sent to the API (e.g. "Basketball").
   * For fallback sports (ALL_HS_SPORTS entries) this equals the display name.
   * NEVER empty after a validated save/read.
   */
  sportName: string;
  /** Display name shown in the UI (e.g. "Boys Basketball"). */
  sportDisplayName: string;
  /** Stored level id (e.g. "VARSITY FEMALE") — what the API expects. */
  level: string;
  // ── Step 2: Coach selection (optional until step 2 is submitted) ────────────
  selectedCoachId?: string;
}

/** Fields that must be non-empty for the prefs to be considered valid. */
const REQUIRED_FIELDS: (keyof ParentOnboardingPrefs)[] = [
  "childName",
  "schoolId",
  "schoolName",
  "sportId",
  "sportName",
  "sportDisplayName",
  "level",
];

// ── Input type for saveOnboardingPrefs ────────────────────────────────────────

/**
 * Everything callers must supply; the module derives and coerces the rest.
 * `sportName` is optional here because API sports always have it but fallback
 * sports (ALL_HS_SPORTS) do not — the module fills it in from sportDisplayName.
 */
export type ParentOnboardingPrefsInput = Omit<ParentOnboardingPrefs, "sportName"> & {
  sportName?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Strip leading/trailing whitespace from all string values in an object.
 * Non-string values are left untouched.
 */
function trimStrings<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])
  ) as T;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate and save onboarding prefs to localStorage.
 *
 * Coerces `sportName` from `sportDisplayName` or `sportId` when the caller
 * omits it (happens with fallback sports that have no dedicated raw sport name).
 *
 * Throws if any required field is still empty after coercion — the caller
 * should treat this as a hard validation failure and redirect to step 1.
 *
 * @returns The cleaned, validated prefs object that was persisted.
 */
export function saveOnboardingPrefs(input: ParentOnboardingPrefsInput): ParentOnboardingPrefs {
  const raw = trimStrings(input) as ParentOnboardingPrefsInput;

  const prefs: ParentOnboardingPrefs = {
    childName: raw.childName,
    schoolId: raw.schoolId,
    schoolName: raw.schoolName,
    athleticDirectorId: raw.athleticDirectorId || "",
    athleticDirectorName: raw.athleticDirectorName || "",
    sportId: raw.sportId,
    // Coerce: raw API sport name → display name → id. Never undefined.
    sportName: (raw.sportName || raw.sportDisplayName || raw.sportId).trim(),
    sportDisplayName: raw.sportDisplayName,
    level: raw.level,
    ...(raw.selectedCoachId ? { selectedCoachId: raw.selectedCoachId } : {}),
  };

  const missing = REQUIRED_FIELDS.filter((k) => !prefs[k]);
  if (missing.length) {
    throw new Error(
      `[onboarding] Cannot save prefs — required fields are empty: ${missing.join(", ")}`
    );
  }

  if (isBrowser()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }
  return prefs;
}

/**
 * Merge partial updates into the currently stored prefs and re-save.
 *
 * Use this in step 2 to add `selectedCoachId` without having to re-supply
 * all the step-1 fields.
 *
 * Returns the merged, validated prefs, or throws if the result is invalid.
 */
export function mergeOnboardingPrefs(
  updates: Partial<ParentOnboardingPrefs>
): ParentOnboardingPrefs {
  const existing = loadOnboardingPrefsRaw();
  const merged: ParentOnboardingPrefsInput = {
    childName: "",
    schoolId: "",
    schoolName: "",
    athleticDirectorId: "",
    athleticDirectorName: "",
    sportId: "",
    sportDisplayName: "",
    level: "",
    ...existing,
    ...updates,
  };
  return saveOnboardingPrefs(merged);
}

/**
 * Read and validate prefs from localStorage.
 *
 * Returns `null` if:
 *   - nothing is stored
 *   - JSON parse fails
 *   - any required field is missing even after coercion
 *
 * When bad/incomplete data is detected the entry is cleared from localStorage
 * so a future load doesn't re-encounter stale garbage.
 */
export function loadOnboardingPrefs(): ParentOnboardingPrefs | null {
  const raw = loadOnboardingPrefsRaw();
  if (!raw) return null;

  // Coerce sportName — repair data written by older page versions that may
  // have stored sportName: undefined for fallback sports.
  if (!raw.sportName) {
    raw.sportName = (raw.sportDisplayName || raw.sportId || "").trim();
  }

  const missing = REQUIRED_FIELDS.filter((k) => !raw[k as keyof typeof raw]);
  if (missing.length) {
    console.warn(
      "[onboarding] Stored prefs are missing required fields:",
      missing,
      "— clearing stale data."
    );
    clearOnboardingPrefs();
    return null;
  }

  return raw as ParentOnboardingPrefs;
}

/**
 * Remove onboarding prefs from localStorage.
 * Call this exactly once, after a successful onboarding submission.
 */
export function clearOnboardingPrefs(): void {
  if (isBrowser()) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// ── Internal ──────────────────────────────────────────────────────────────────

/** Raw parse with no validation — returns null on any error. */
function loadOnboardingPrefsRaw(): Partial<ParentOnboardingPrefs> | null {
  if (!isBrowser()) return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as Partial<ParentOnboardingPrefs>;
  } catch {
    clearOnboardingPrefs();
    return null;
  }
}
