// Field-agnostic primitives behind the redundancy predicates used by
// pen-fields.ts and tablet-fields.ts. Kept in one place so a tweak to
// the matching rule (e.g. a new edge case) only happens once.

/** True when `token` (typically a model ID) appears in `name` as the
 * full string or as a whole token. Token boundary = start/end of string
 * or any non-alphanumeric character. Case-insensitive.
 *
 * Catches "Asus ProArt Pen MPA01" / "MPA01" but _not_ "MX300" / "M3". */
export function tokenAppearsInName(name: string, token: string): boolean {
  if (!token || !name) return false;
  if (name === token) return true;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?:[^A-Za-z0-9]|$)`, "i").test(name);
}

/** True when `name` starts with `displayBrand` (case-insensitive),
 * either as the full string or followed by a space. Catches "Wacom One
 * Pen" / "Wacom" and "Apple Pencil Pro" / "Apple". */
export function brandPrefixesName(displayBrand: string, name: string): boolean {
  if (!displayBrand || !name) return false;
  const lower = name.toLowerCase();
  const prefix = displayBrand.toLowerCase();
  return lower === prefix || lower.startsWith(prefix + " ");
}
