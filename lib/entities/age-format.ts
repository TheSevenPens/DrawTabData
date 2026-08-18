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

/**
 * The date an age should be measured from, for a record carrying both a
 * (possibly absent) precise ReleaseDate and a coarse ReleaseYear.
 *
 * ReleaseDate wins at any ISO precision. ReleaseYear is only a fallback
 * because it pins Jan 1, which overstates a mid-year release by up to a
 * year — an April 2026 tablet read as Jan 1 2026 is ~106 days too old.
 * Returns undefined when neither is usable.
 */
export function releaseOrigin(
  releaseDate: string | undefined,
  releaseYear: string | undefined,
): string | undefined {
  if (releaseDate && !isNaN(new Date(releaseDate).getTime())) return releaseDate;
  const year = parseInt(releaseYear ?? "", 10);
  return isNaN(year) ? undefined : `${year}-01-01`;
}

/**
 * True when the record's origin date is still in the future — announced or
 * up for pre-order but not yet shipped. Such a record has no age, and both
 * ways of rendering one mislead: formatAge collapses a negative span to
 * "today" (reads as "released today"), and a raw day count sorts the
 * product among things that have actually shipped.
 */
export function isUnreleased(
  releaseDate: string | undefined,
  releaseYear: string | undefined,
): boolean {
  const days = ageInDays(releaseOrigin(releaseDate, releaseYear));
  return days !== null && days < 0;
}

/**
 * Whole years in a day count, on the same 365.25 basis formatAge uses — so a
 * field's sortable number and its displayed span can't disagree about which
 * year something falls in.
 */
export function ageInYears(days: number): number {
  return Math.floor(days / DAYS_PER_YEAR);
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
