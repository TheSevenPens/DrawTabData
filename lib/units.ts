export type UnitPreference = "metric" | "imperial";

const STORAGE_KEY = "drawtabdata-unit-preference";

export function loadUnitPreference(): UnitPreference {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === "imperial" ? "imperial" : "metric";
  } catch {
    return "metric";
  }
}

export function saveUnitPreference(pref: UnitPreference) {
  localStorage.setItem(STORAGE_KEY, pref);
}

interface UnitConversion {
  imperialUnit: string;
  convert: (value: number) => number;
}

const CONVERSIONS: Record<string, UnitConversion> = {
  mm: { imperialUnit: "in", convert: (v) => v * 0.03937 },
  g: { imperialUnit: "oz", convert: (v) => v * 0.03527 },
  LPmm: { imperialUnit: "LPI", convert: (v) => v * 25.4 },
  "px/mm": { imperialUnit: "PPI", convert: (v) => v * 25.4 },
};

export function getDisplayUnit(metricUnit: string, pref: UnitPreference): string {
  if (pref === "imperial" && metricUnit in CONVERSIONS) {
    return CONVERSIONS[metricUnit]!.imperialUnit;
  }
  return metricUnit;
}

export function formatValue(
  rawValue: string,
  metricUnit: string | undefined,
  pref: UnitPreference,
): string {
  if (!rawValue || !metricUnit) return rawValue;

  if (pref === "imperial" && metricUnit in CONVERSIONS) {
    const conv = CONVERSIONS[metricUnit]!;

    // Handle multi-part dimension values like "345 x 216" or "330.25 x 197.00 x 11.80"
    if (rawValue.includes(" x ")) {
      const parts = rawValue.split(" x ");
      const converted = parts.map((p) => {
        const num = Number(p.trim());
        return isNaN(num) ? p : conv.convert(num).toFixed(2);
      });
      return converted.join(" x ");
    }

    const num = Number(rawValue);
    if (isNaN(num)) return rawValue;
    return conv.convert(num).toFixed(2);
  }

  return rawValue;
}

export function getFieldLabel(
  label: string,
  metricUnit: string | undefined,
  pref: UnitPreference,
): string {
  if (!metricUnit) return label;

  const displayUnit = getDisplayUnit(metricUnit, pref);

  // If label already contains a unit in parens, replace it
  const parenMatch = label.match(/^(.+)\s*\(([^)]+)\)$/);
  if (parenMatch) {
    return `${parenMatch[1].trim()} (${displayUnit})`;
  }

  return label;
}
