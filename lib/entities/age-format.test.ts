import { describe, it, expect, afterEach, vi } from "vitest";
import { formatAge, ageInDays, ageInYears, releaseOrigin, isUnreleased } from "./age-format.js";

describe("formatAge", () => {
  it("returns 'today' for zero or negative days", () => {
    expect(formatAge(0)).toBe("today");
    expect(formatAge(-5)).toBe("today");
  });

  it("formats days under a week", () => {
    expect(formatAge(1)).toBe("1 day");
    expect(formatAge(5)).toBe("5 days");
  });

  it("formats weeks under a month", () => {
    expect(formatAge(7)).toBe("1 week");
    expect(formatAge(21)).toBe("3 weeks");
  });

  it("formats months (one decimal) under a year", () => {
    expect(formatAge(304)).toBe("10 months"); // ~10.0
    expect(formatAge(107)).toBe("3.5 months");
  });

  it("formats years and year+months", () => {
    // 365 is just under DAYS_PER_YEAR (365.25), so it's still "12 months".
    expect(formatAge(365)).toBe("12 months");
    expect(formatAge(366)).toBe("1 year");
    expect(formatAge(730)).toBe("2 years");
    // ~1 year 4 months
    expect(formatAge(487)).toBe("1 year 4 months");
  });

  it("rolls rounded months up into a year", () => {
    // a hair under 2 years should not render "1 year 12 months"
    expect(formatAge(Math.round(365.25 * 2) - 1)).toBe("2 years");
  });
});

describe("ageInDays", () => {
  it("returns null for missing or unparseable dates", () => {
    expect(ageInDays(undefined)).toBeNull();
    expect(ageInDays("")).toBeNull();
    expect(ageInDays("not-a-date")).toBeNull();
  });

  it("returns a non-negative day count for a past date, accepting partial ISO", () => {
    expect(ageInDays("2000-01-01")).toBeGreaterThan(0);
    expect(ageInDays("2007-11")).toBeGreaterThan(0);
    expect(ageInDays("1984")).toBeGreaterThan(0);
  });
});

describe("ageInYears", () => {
  it("floors to whole years on the same 365.25 basis as formatAge", () => {
    expect(ageInYears(0)).toBe(0);
    expect(ageInYears(122)).toBe(0); // "4 months"
    expect(ageInYears(365)).toBe(0); // formatAge still says "12 months"
    expect(ageInYears(366)).toBe(1); // formatAge says "1 year"
    expect(ageInYears(730)).toBe(1); // 730 / 365.25 = 1.998
    expect(ageInYears(731)).toBe(2);
  });

  it("agrees with the year formatAge names, across the CT-0405-U span", () => {
    // The record that used to display "28 years 9 months" while sorting as 22.
    expect(formatAge(10516)).toBe("28 years 9 months");
    expect(ageInYears(10516)).toBe(28);
  });
});

describe("releaseOrigin", () => {
  it("prefers ReleaseDate at any ISO precision", () => {
    expect(releaseOrigin("2026-04-17", "2026")).toBe("2026-04-17");
    expect(releaseOrigin("2018-07", "2018")).toBe("2018-07");
    expect(releaseOrigin("2018", "2018")).toBe("2018");
  });

  it("falls back to Jan 1 of LaunchYear when ReleaseDate is absent or junk", () => {
    expect(releaseOrigin(undefined, "2026")).toBe("2026-01-01");
    expect(releaseOrigin("", "2026")).toBe("2026-01-01");
    expect(releaseOrigin("not-a-date", "2026")).toBe("2026-01-01");
  });

  it("returns undefined when neither is usable", () => {
    expect(releaseOrigin(undefined, undefined)).toBeUndefined();
    expect(releaseOrigin("not-a-date", "unknown")).toBeUndefined();
  });
});

describe("isUnreleased", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function at(iso: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  }

  it("is true for a ship date still in the future", () => {
    at("2026-08-17T00:00:00Z");
    // The XPPen Artist Ultra 14 case: pre-order, ships 2026-08-31. Reading
    // the age off LaunchYear alone made this look 227 days old.
    expect(isUnreleased("2026-08-31", "2026")).toBe(true);
  });

  it("is false on and after the release date", () => {
    at("2026-08-31T00:00:00Z");
    expect(isUnreleased("2026-08-31", "2026")).toBe(false);
    at("2026-09-01T00:00:00Z");
    expect(isUnreleased("2026-08-31", "2026")).toBe(false);
  });

  it("uses the LaunchYear fallback when there is no ReleaseDate", () => {
    at("2026-08-17T00:00:00Z");
    expect(isUnreleased(undefined, "2027")).toBe(true);
    expect(isUnreleased(undefined, "2026")).toBe(false);
  });

  it("is false when no date is usable — unknown is not unreleased", () => {
    at("2026-08-17T00:00:00Z");
    expect(isUnreleased(undefined, undefined)).toBe(false);
  });
});
