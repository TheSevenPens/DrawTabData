import { describe, it, expect } from "vitest";
import { formatAge, ageInDays } from "./age-format.js";

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
