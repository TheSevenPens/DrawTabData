// Resolve a tablet's last-supported-driver strings to Driver entities
// (DrawTabDataExplorer #307).
//
// Model.LastSupportedWindowsDriver / LastSupportedMacOSDriver stay the
// verbatim strings from Wacom's end-of-support page ("6.3.46-2"); they are
// matched to a Driver on read, never migrated. Matching is exact first, then
// separator-insensitive on the build number: the EOSL page writes
// "6.3.46-2" where newer Driver records store "6.3.46.2" — same build.

export type DriverPlatform = "WINDOWS" | "MACOS";

export const LAST_SUPPORTED_DRIVER_FIELDS = [
  { field: "LastSupportedWindowsDriver", platform: "WINDOWS" },
  { field: "LastSupportedMacOSDriver", platform: "MACOS" },
] as const satisfies readonly { field: string; platform: DriverPlatform }[];

/**
 * Last-supported builds with no Driver record, left unlinked on purpose
 * (maintainer's call on #307): Wacom shipped a different macOS build than
 * the Windows one and our Driver data only carries the latter. Keyed
 * `PLATFORM|version`. Data-quality exempts these; add a Driver record and
 * remove the entry to link it.
 */
export const UNRECORDED_DRIVERS: ReadonlySet<string> = new Set([
  "MACOS|6.1.6-4",
  "MACOS|6.2.0w4",
  "MACOS|6.3.46-2",
]);

/** "6.3.46.2" and "6.3.46-2" -> the same key: the separator before the last segment is normalised. */
export function driverVersionKey(version: string): string {
  return version.trim().toLowerCase().replace(/[.-](?=[^.-]+$)/, "-");
}

interface DriverLike {
  EntityId: string;
  Brand: string;
  DriverVersion: string;
  OSFamily: string;
}

export interface DriverIndex {
  exact: Map<string, string>;
  normalized: Map<string, string>;
}

const indexKey = (brand: string, platform: string, version: string) => `${brand}|${platform}|${version}`;

export function buildDriverIndex(drivers: readonly DriverLike[]): DriverIndex {
  const exact = new Map<string, string>();
  const normalized = new Map<string, string>();
  for (const d of drivers) {
    exact.set(indexKey(d.Brand, d.OSFamily, d.DriverVersion.trim()), d.EntityId);
    const nk = indexKey(d.Brand, d.OSFamily, driverVersionKey(d.DriverVersion));
    if (!normalized.has(nk)) normalized.set(nk, d.EntityId);
  }
  return { exact, normalized };
}

/** The Driver EntityId a tablet's version string names, or undefined. */
export function resolveDriver(
  index: DriverIndex,
  brand: string,
  platform: DriverPlatform,
  version: string,
): string | undefined {
  return (
    index.exact.get(indexKey(brand, platform, version.trim())) ??
    index.normalized.get(indexKey(brand, platform, driverVersionKey(version)))
  );
}
