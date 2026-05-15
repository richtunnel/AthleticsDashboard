const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const MONTH_ABBR: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

export function monthNameToIndex(name: string): number {
  return MONTH_ABBR[name.toLowerCase()] ?? -1;
}

export function monthIndexToName(index: number): string {
  return MONTH_NAMES[index] ?? "";
}

export function dateToLocalISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toISODate(value: Date | string): string {
  if (value instanceof Date) {
    return dateToLocalISO(value);
  }
  if (value.includes("T")) {
    return value.split("T")[0];
  }
  return value;
}

export function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function canonicalizeMonths(raw: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const r of raw) {
    const idx = monthNameToIndex(r);
    if (idx !== -1) {
      const name = MONTH_NAMES[idx];
      if (!seen.has(name)) {
        seen.add(name);
        result.push(name);
      }
    }
  }
  return result;
}
