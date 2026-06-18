// Shared "nice" age formatting, used by Driver.Age and Tablet.Age field-defs
// so both render an identical human-friendly span. Extracted from
// driver-fields.ts so the tablet fields can reuse it (and so formatAge has
// focused tests). See age-format.test.ts.

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_MONTH = 365.25 / 12; // ≈ 30.44
const DAYS_PER_YEAR = 365.25;

/** Whole days between a date (ISO, any precision) and now, or null if
 * missing/unparseable. "2025-10-22", "2007-11", and "1984" all parse. */
export function ageInDays(date: string | undefined): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / MS_PER_DAY);
}

/** One-decimal, trailing-".0" trimmed (e.g. 3.5 → "3.5", 2.0 → "2"). */
function trim1(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

/**
 * Human-friendly age string from a day count, picking the unit that reads
 * most naturally: days → weeks → months (one decimal) → "Y year(s) M month(s)".
 * Examples: "5 days", "1 week", "3.5 months", "1 year 4 months".
 */
export function formatAge(days: number): string {
  const d = Math.floor(days);
  if (d <= 0) return "today";
  if (d < 7) return `${d} day${d === 1 ? "" : "s"}`;
  if (d < 30) {
    const w = Math.round(d / 7);
    return `${w} week${w === 1 ? "" : "s"}`;
  }
  if (d < DAYS_PER_YEAR) {
    const months = trim1(d / DAYS_PER_MONTH);
    return `${months} month${months === "1" ? "" : "s"}`;
  }
  let years = Math.floor(d / DAYS_PER_YEAR);
  let months = Math.round((d - years * DAYS_PER_YEAR) / DAYS_PER_MONTH);
  if (months >= 12) {
    years += 1;
    months -= 12;
  }
  const yPart = `${years} year${years === 1 ? "" : "s"}`;
  return months > 0 ? `${yPart} ${months} month${months === 1 ? "" : "s"}` : yPart;
}
